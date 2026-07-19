import { describe, expect, it, vi } from "vitest";
import {
  AccountAssetClientError,
  HttpAccountAssetClient
} from "./account-asset-client";
import type { AccountAssetClientErrorCode } from "./account-asset-client";
import { HttpAccountClient } from "./account-client";
import {
  BrowserAccountIdentityBinding,
  type AccountMutationPublisher
} from "./account-identity-binding";
import {
  AccountCookieSerialisationUnavailableError,
  type AccountCookieRequestSerialiser
} from "./account-cookie-request-serialiser";

const MAX_ASSET_BYTES = 4 * 1_024 * 1_024;
const pngBytes = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01
]);
const jpegBytes = Uint8Array.from([0xff, 0xd8, 0xff, 0x00, 0xff, 0xd9]);
const webpBytes = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x08, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20
]);

const hexDigest = async (bytes: Uint8Array): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const asset = async (bytes = pngBytes, contentType = "image/png"): Promise<Blob> =>
  new Blob([bytes.slice().buffer], { type: contentType });

const manifest = (sha256: string, byteLength = pngBytes.byteLength) => ({
  schema: "advertising-game-account-asset",
  version: 1,
  asset: {
    id: sha256,
    sha256,
    contentType: "image/png",
    byteLength,
    href: `/api/account/assets/${sha256}`
  }
});

const activeBinding = (): BrowserAccountIdentityBinding => {
  const binding = new BrowserAccountIdentityBinding();
  binding.activate("team-one");
  return binding;
};

const queuedSerialiser = (): AccountCookieRequestSerialiser => {
  let tail = Promise.resolve();
  return {
    run<T>(operation: () => Promise<T>): Promise<T> {
      const result = tail.then(operation);
      tail = result.then(() => undefined, () => undefined);
      return result;
    }
  };
};

const quietPublisher = (): AccountMutationPublisher => ({ publish: vi.fn() });

describe("HttpAccountAssetClient", () => {
  it("invokes the browser fetch implementation with the global receiver", async () => {
    const digest = await hexDigest(pngBytes);
    const fetcher = (function (this: unknown): Promise<Response> {
      if (this !== globalThis) return Promise.reject(new TypeError("Illegal invocation"));
      return Promise.resolve(Response.json(manifest(digest)));
    }) as typeof fetch;
    const client = new HttpAccountAssetClient(activeBinding(), fetcher);

    await expect(client.put(await asset())).resolves.toMatchObject({ sha256: digest });
  });

  it("fails closed before asset fetch when cookie ordering is unavailable", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const unavailable: AccountCookieRequestSerialiser = {
      run: async () => { throw new AccountCookieSerialisationUnavailableError(); }
    };
    const client = new HttpAccountAssetClient(activeBinding(), fetcher, unavailable);

    await expect(client.get("a".repeat(64))).rejects.toEqual(
      new AccountAssetClientError("ASSET_UNAVAILABLE")
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("holds the shared cookie lock through an asset response before login begins", async () => {
    let releaseAsset!: () => void;
    const assetResponse = new Promise<Response>((resolve) => {
      releaseAsset = () => resolve(Response.json({ error: "ASSET_NOT_FOUND" }, { status: 404 }));
    });
    const order: string[] = [];
    const assetFetch = vi.fn<typeof fetch>(async () => {
      order.push("asset-start");
      const response = await assetResponse;
      order.push("asset-finish");
      return response;
    });
    const loginFetch = vi.fn<typeof fetch>(async () => {
      order.push("login");
      return Response.json({ authenticated: true, username: "team-b" });
    });
    const serialiser = queuedSerialiser();
    const assetClient = new HttpAccountAssetClient(activeBinding(), assetFetch, serialiser);
    const accountClient = new HttpAccountClient(
      new BrowserAccountIdentityBinding(), quietPublisher(), loginFetch, serialiser
    );

    const download = assetClient.get("a".repeat(64));
    await vi.waitFor(() => expect(assetFetch).toHaveBeenCalledOnce());
    const login = accountClient.login({ username: "team-b", password: "password-123" });
    await Promise.resolve();
    expect(loginFetch).not.toHaveBeenCalled();

    releaseAsset();
    await expect(download).rejects.toEqual(new AccountAssetClientError("ASSET_NOT_FOUND"));
    await expect(login).resolves.toMatchObject({ username: "team-b" });
    expect(order).toEqual(["asset-start", "asset-finish", "login"]);
  });

  it("uses bounded streaming JSON for asset manifests and errors", async () => {
    const digest = await hexDigest(pngBytes);
    const created = Response.json(manifest(digest));
    const createdJson = vi.spyOn(created, "json").mockRejectedValue(new Error("unbounded parser used"));
    const denied = Response.json({ error: "ASSET_QUOTA_EXCEEDED" }, { status: 409 });
    const deniedJson = vi.spyOn(denied, "json").mockRejectedValue(new Error("unbounded parser used"));
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(created).mockResolvedValueOnce(denied);
    const client = new HttpAccountAssetClient(activeBinding(), fetcher);

    await expect(client.put(await asset())).resolves.toMatchObject({ sha256: digest });
    await expect(client.get(digest)).rejects.toEqual(new AccountAssetClientError("ASSET_QUOTA_EXCEEDED"));
    expect(createdJson).not.toHaveBeenCalled();
    expect(deniedJson).not.toHaveBeenCalled();
  });

  it("uploads a verified PNG to the exact same-origin immutable path", async () => {
    const digest = await hexDigest(pngBytes);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(manifest(digest), { status: 201 }));
    const client = new HttpAccountAssetClient(activeBinding(), fetcher);

    await expect(client.put(await asset())).resolves.toEqual({
      sha256: digest,
      contentType: "image/png",
      byteLength: pngBytes.byteLength
    });
    expect(fetcher).toHaveBeenCalledWith(`/api/account/assets/${digest}`, {
      method: "PUT",
      credentials: "same-origin",
      redirect: "error",
      headers: {
        accept: "application/json",
        "content-type": "image/png",
        "x-admarket-account": "team-one"
      },
      body: await asset()
    });
  });

  it.each([
    ["JPEG", jpegBytes, "image/jpeg"],
    ["WebP", webpBytes, "image/webp"]
  ])("uploads a verified %s", async (_name, bytes, contentType) => {
    const digest = await hexDigest(bytes);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      ...manifest(digest, bytes.byteLength),
      asset: { ...manifest(digest, bytes.byteLength).asset, contentType }
    }));
    const client = new HttpAccountAssetClient(activeBinding(), fetcher);

    await expect(client.put(await asset(bytes, contentType))).resolves.toEqual({
      sha256: digest,
      contentType,
      byteLength: bytes.byteLength
    });
  });

  it.each([
    ["SVG", new TextEncoder().encode("<svg></svg>"), "image/svg+xml", "UNSUPPORTED_ASSET"],
    ["unknown MIME", pngBytes, "application/octet-stream", "UNSUPPORTED_ASSET"],
    ["mismatched PNG MIME", pngBytes, "image/jpeg", "UNSUPPORTED_ASSET"],
    ["bad JPEG signature", Uint8Array.from([0xff, 0xd8, 0xff, 0x00]), "image/jpeg", "UNSUPPORTED_ASSET"],
    ["oversize", new Uint8Array(MAX_ASSET_BYTES + 1), "image/png", "ASSET_TOO_LARGE"],
    ["zero bytes", new Uint8Array(), "image/png", "UNSUPPORTED_ASSET"]
  ])("rejects %s locally before a request", async (_name, bytes, contentType, code) => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new HttpAccountAssetClient(activeBinding(), fetcher);

    await expect(client.put(await asset(bytes, contentType))).rejects.toEqual(
      new AccountAssetClientError(code as AccountAssetClientErrorCode)
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects malformed or self-inconsistent PUT manifests", async () => {
    const digest = await hexDigest(pngBytes);
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ ...manifest(digest), extra: true }))
      .mockResolvedValueOnce(Response.json({ ...manifest(digest), asset: {
        ...manifest(digest).asset, sha256: "0".repeat(64)
      } }));
    const client = new HttpAccountAssetClient(activeBinding(), fetcher);

    await expect(client.put(await asset())).rejects.toEqual(new AccountAssetClientError("INVALID_RESPONSE"));
    await expect(client.put(await asset())).rejects.toEqual(new AccountAssetClientError("ASSET_INTEGRITY_FAILED"));
  });

  it("downloads a verified binary asset only from the exact digest route", async () => {
    const digest = await hexDigest(pngBytes);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(pngBytes, {
      headers: { "content-type": "image/png", "content-length": String(pngBytes.byteLength) }
    }));
    const client = new HttpAccountAssetClient(activeBinding(), fetcher);

    const result = await client.get(digest);
    expect(result.sha256).toBe(digest);
    expect(result.contentType).toBe("image/png");
    expect(new Uint8Array(await result.blob.arrayBuffer())).toEqual(pngBytes);
    expect(fetcher).toHaveBeenCalledWith(`/api/account/assets/${digest}`, {
      method: "GET",
      credentials: "same-origin",
      redirect: "error",
      headers: {
        accept: "image/png, image/jpeg, image/webp",
        "x-admarket-account": "team-one"
      }
    });
  });

  it("streams GET data with a hard byte ceiling even when Content-Length lies", async () => {
    const digest = await hexDigest(pngBytes);
    const response = new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_ASSET_BYTES + 1));
        controller.close();
      }
    }), {
      headers: { "content-type": "image/png", "content-length": String(pngBytes.byteLength) }
    });
    const arrayBuffer = vi.spyOn(response, "arrayBuffer").mockRejectedValue(new Error("unbounded buffer used"));
    const client = new HttpAccountAssetClient(
      activeBinding(),
      vi.fn<typeof fetch>().mockResolvedValue(response)
    );

    await expect(client.get(digest)).rejects.toEqual(new AccountAssetClientError("ASSET_INTEGRITY_FAILED"));
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it.each([
    ["digest", { "content-type": "image/png", "content-length": String(pngBytes.byteLength) }, Uint8Array.from([...pngBytes, 0]), "ASSET_INTEGRITY_FAILED"],
    ["length", { "content-type": "image/png", "content-length": "99" }, pngBytes, "ASSET_INTEGRITY_FAILED"],
    ["MIME", { "content-type": "image/jpeg", "content-length": String(pngBytes.byteLength) }, pngBytes, "ASSET_INTEGRITY_FAILED"],
    ["signature", { "content-type": "image/png", "content-length": "8" }, new Uint8Array(8), "ASSET_INTEGRITY_FAILED"],
    ["missing length", { "content-type": "image/png" }, pngBytes, "INVALID_RESPONSE"]
  ])("rejects GET %s integrity failures", async (_name, headers, bytes, code) => {
    const digest = await hexDigest(pngBytes);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(bytes, { headers }));
    const client = new HttpAccountAssetClient(activeBinding(), fetcher);

    await expect(client.get(digest)).rejects.toEqual(
      new AccountAssetClientError(code as AccountAssetClientErrorCode)
    );
  });

  it("rejects invalid digest paths locally", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new HttpAccountAssetClient(activeBinding(), fetcher);

    await expect(client.get("../outside")).rejects.toEqual(new AccountAssetClientError("INVALID_REQUEST"));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    [401, { error: "AUTHENTICATION_REQUIRED" }, "AUTHENTICATION_REQUIRED"],
    [409, { error: "ASSET_QUOTA_EXCEEDED" }, "ASSET_QUOTA_EXCEEDED"],
    [503, { error: "ASSET_UNAVAILABLE" }, "ASSET_UNAVAILABLE"],
    [500, { error: "do-not-echo" }, "ASSET_UNAVAILABLE"]
  ])("maps bounded HTTP %i errors", async (status, body, code) => {
    const digest = await hexDigest(pngBytes);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body, { status }));
    const client = new HttpAccountAssetClient(activeBinding(), fetcher);

    await expect(client.get(digest)).rejects.toEqual(
      new AccountAssetClientError(code as AccountAssetClientErrorCode)
    );
  });

  it("maps network failures to unavailable without exposing error contents", async () => {
    const digest = await hexDigest(pngBytes);
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("sensitive upstream detail"));
    const client = new HttpAccountAssetClient(activeBinding(), fetcher);

    await expect(client.get(digest)).rejects.toEqual(new AccountAssetClientError("ASSET_UNAVAILABLE"));
  });

  it("refuses unbound transfers and maps a changed cookie identity to reauthentication", async () => {
    const digest = await hexDigest(pngBytes);
    const fetcher = vi.fn<typeof fetch>();
    const binding = new BrowserAccountIdentityBinding();
    const client = new HttpAccountAssetClient(binding, fetcher);

    await expect(client.get(digest)).rejects.toEqual(
      new AccountAssetClientError("AUTHENTICATION_REQUIRED")
    );
    await expect(client.put(await asset())).rejects.toEqual(
      new AccountAssetClientError("AUTHENTICATION_REQUIRED")
    );
    expect(fetcher).not.toHaveBeenCalled();

    binding.activate("team-one");
    fetcher.mockResolvedValue(Response.json({
      error: "ACCOUNT_IDENTITY_CHANGED"
    }, { status: 409 }));
    await expect(client.get(digest)).rejects.toEqual(
      new AccountAssetClientError("AUTHENTICATION_REQUIRED")
    );
  });
});
