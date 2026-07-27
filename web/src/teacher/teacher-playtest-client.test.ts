import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createBlankCampaignDocument } from "../domain/campaign-document";
import {
  HttpTeacherPlaytestClient,
  TeacherPlaytestClientError
} from "./teacher-playtest-client";

const updatedAt = "2026-07-27T04:00:00.000Z";
const operationId = "123e4567-e89b-42d3-a456-426614174000";

const campaign = () => createBlankCampaignDocument({
  documentId: "campaign-main",
  sessionId: "teacher-session",
  teamId: "teacher-team",
  mode: "offline"
});

const pngBytes = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01
]);

const requestHeaders = (init: RequestInit | undefined): Headers =>
  new Headers(init?.headers);

describe("HttpTeacherPlaytestClient", () => {
  it("lists playtest progress through the teacher route without pair identity data", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      schema: "advertising-game-progress",
      version: 1,
      documents: [{
        documentId: "campaign-main",
        revision: 2,
        updatedAt
      }]
    }));
    const client = new HttpTeacherPlaytestClient({ fetcher });

    await expect(client.list()).resolves.toEqual([{
      documentId: "campaign-main",
      revision: 2,
      updatedAt
    }]);
    const [path, init] = fetcher.mock.calls[0]!;
    expect(path).toBe("/api/teacher/playtest/progress");
    expect(init?.credentials).toBe("same-origin");
    expect(init?.redirect).toBe("error");
    expect(requestHeaders(init).has("x-ad-market-account")).toBe(false);
    expect(String(init?.body ?? "")).not.toContain("teacher-playtest");
  });

  it("saves an exact bounded progress document through the teacher route", async () => {
    const document = campaign();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      schema: "advertising-game-progress",
      version: 1,
      documentId: document.documentId,
      revision: 3,
      updatedAt
    }));
    const client = new HttpTeacherPlaytestClient({ fetcher });

    await expect(client.save(document, 2)).resolves.toEqual({
      status: "saved",
      revision: 3,
      updatedAt
    });
    const [path, init] = fetcher.mock.calls[0]!;
    expect(path).toBe("/api/teacher/playtest/progress");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body))).toEqual({
      schema: "advertising-game-progress",
      version: 1,
      documentId: document.documentId,
      expectedRevision: 2,
      document
    });
  });

  it("uploads assets through the teacher route and validates the rewritten href", async () => {
    const digest = createHash("sha256").update(pngBytes).digest("hex");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      schema: "advertising-game-account-asset",
      version: 1,
      asset: {
        id: digest,
        sha256: digest,
        contentType: "image/png",
        byteLength: pngBytes.byteLength,
        href: `/api/teacher/playtest/assets/${digest}`
      }
    }, { status: 201 }));
    const client = new HttpTeacherPlaytestClient({ fetcher });

    await expect(client.put(new Blob([pngBytes], { type: "image/png" }))).resolves.toEqual({
      sha256: digest,
      contentType: "image/png",
      byteLength: pngBytes.byteLength
    });
    const [path, init] = fetcher.mock.calls[0]!;
    expect(path).toBe(`/api/teacher/playtest/assets/${digest}`);
    expect(init?.method).toBe("PUT");
    expect(requestHeaders(init).has("x-ad-market-account")).toBe(false);
  });

  it("downloads and verifies playtest asset bytes without requiring Content-Length", async () => {
    const digest = createHash("sha256").update(pngBytes).digest("hex");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(pngBytes, {
      status: 200,
      headers: { "content-type": "image/png" }
    }));
    const client = new HttpTeacherPlaytestClient({ fetcher });

    const result = await client.get(digest);
    expect(result).toMatchObject({
      sha256: digest,
      contentType: "image/png",
      byteLength: pngBytes.byteLength
    });
    await expect(result.blob.arrayBuffer()).resolves.toEqual(pngBytes.buffer);
  });

  it("sends the exact factory-reset contract only after exact RESET", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      status: "reset",
      operationId
    }));
    const client = new HttpTeacherPlaytestClient({ fetcher });

    await expect(client.reset({
      operationId,
      confirmation: "RESET"
    })).resolves.toBe("reset");
    const [path, init] = fetcher.mock.calls[0]!;
    expect(path).toBe("/api/teacher/playtest/reset");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      schema: "ad-market-teacher-playtest-reset",
      version: 1,
      operationId,
      confirmation: "RESET"
    });
  });

  it("maps a missing teacher session without parsing or exposing credentials", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 })
    );
    const client = new HttpTeacherPlaytestClient({ fetcher });

    await expect(client.reset({
      operationId,
      confirmation: "RESET"
    })).rejects.toEqual(
      new TeacherPlaytestClientError("AUTHENTICATION_REQUIRED", 401)
    );
  });
});
