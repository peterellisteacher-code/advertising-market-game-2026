// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import {
  SupabaseImageLabAllowanceStore,
  type ImageLabAllowanceSnapshot
} from "./image-lab-allowance-store";

const userId = "b9b32e20-0ba8-4896-b89f-44efdfc52942";
const requestHash = "a".repeat(64);
const snapshot = (
  status: ImageLabAllowanceSnapshot["status"] = "available"
): ImageLabAllowanceSnapshot => ({
  status,
  enabled: true,
  object: { granted: 4, consumed: 1, reserved: 1, remaining: 2 },
  realise: { granted: 1, consumed: 0, reserved: 0, remaining: 1 }
});

describe("SupabaseImageLabAllowanceStore", () => {
  it("derives bounded read identities and preserves every mutation identity", async () => {
    const rpc = vi.fn().mockResolvedValue(snapshot());
    const store = new SupabaseImageLabAllowanceStore({ imageLabRpc: rpc });

    await store.status(userId);
    await store.globalStatus();
    await store.setGlobal({
      target: "enabled",
      enabled: false,
      operationId: "global:enabled:1",
      requestHash
    });
    await store.setGlobal({
      target: "default",
      stage: "realise",
      amount: 2,
      operationId: "global:realise:1",
      requestHash
    });
    await store.set({
      userId,
      stage: "object",
      amount: 3,
      operationId: "set:team-one:1",
      requestHash
    });
    await store.add({
      userId,
      stage: "object",
      amount: 2,
      operationId: "add:team-one:1",
      requestHash
    });
    await store.revoke({
      userId,
      stage: "realise",
      amount: 1,
      operationId: "revoke:team-one:1",
      requestHash
    });
    await store.reserve({
      userId,
      stage: "object",
      operationId: "image-job:request-123",
      jobKey: "request-123",
      requestHash
    });
    for (const operation of ["complete", "refund", "markUncertain"] as const) {
      await store[operation]({
        userId,
        stage: "object",
        operationId: "image-job:request-123",
        jobKey: "request-123",
        requestHash
      });
    }

    expect(rpc.mock.calls.map(([input]) => input)).toEqual([
      {
        userId,
        ledgerOperation: "status",
        operationId: expect.stringMatching(/^status:[a-f0-9]{64}$/u),
        requestHash: expect.stringMatching(/^[a-f0-9]{64}$/u)
      },
      {
        ledgerOperation: "global_status",
        operationId: expect.stringMatching(/^global-status:[a-f0-9]{64}$/u),
        requestHash: expect.stringMatching(/^[a-f0-9]{64}$/u)
      },
      {
        ledgerOperation: "set_global",
        amount: 0,
        operationId: "global:enabled:1",
        requestHash
      },
      {
        ledgerOperation: "set_global",
        stage: "realise",
        amount: 2,
        operationId: "global:realise:1",
        requestHash
      },
      {
        userId,
        ledgerOperation: "set",
        stage: "object",
        amount: 3,
        operationId: "set:team-one:1",
        requestHash
      },
      {
        userId,
        ledgerOperation: "add",
        stage: "object",
        amount: 2,
        operationId: "add:team-one:1",
        requestHash
      },
      {
        userId,
        ledgerOperation: "revoke",
        stage: "realise",
        amount: 1,
        operationId: "revoke:team-one:1",
        requestHash
      },
      {
        userId,
        ledgerOperation: "reserve",
        stage: "object",
        amount: 1,
        operationId: "image-job:request-123",
        jobKey: "request-123",
        requestHash
      },
      {
        userId,
        ledgerOperation: "complete",
        stage: "object",
        amount: 1,
        operationId: "image-job:request-123",
        jobKey: "request-123",
        requestHash
      },
      {
        userId,
        ledgerOperation: "refund",
        stage: "object",
        amount: 1,
        operationId: "image-job:request-123",
        jobKey: "request-123",
        requestHash
      },
      {
        userId,
        ledgerOperation: "mark_uncertain",
        stage: "object",
        amount: 1,
        operationId: "image-job:request-123",
        jobKey: "request-123",
        requestHash
      }
    ]);
  });

  it("parses the broker list with aliases and never accepts browser-visible user IDs", async () => {
    const response = {
      ...snapshot(),
      accounts: [{
        alias: "team-one",
        object: snapshot().object,
        realise: snapshot().realise
      }]
    };
    const rpc = vi.fn().mockResolvedValue(response);
    const store = new SupabaseImageLabAllowanceStore({ imageLabRpc: rpc });

    await expect(store.list()).resolves.toEqual(response.accounts);
    expect(rpc).toHaveBeenCalledWith({
      ledgerOperation: "list",
      operationId: expect.stringMatching(/^list:[a-f0-9]{64}$/u),
      requestHash: expect.stringMatching(/^[a-f0-9]{64}$/u)
    });

    rpc.mockResolvedValueOnce({
      ...response,
      accounts: [{ ...response.accounts[0], userId }]
    });
    await expect(store.list()).rejects.toThrow("IMAGE_LAB_ALLOWANCE_UNAVAILABLE");
  });

  it("rejects malformed snapshots, mismatched stage data and locally tempting arithmetic", async () => {
    const rpc = vi.fn();
    const store = new SupabaseImageLabAllowanceStore({ imageLabRpc: rpc });
    for (const result of [
      { ...snapshot(), surprise: true },
      { ...snapshot(), object: { granted: 4, consumed: 1, reserved: 1, remaining: 99 } },
      { ...snapshot(), realise: { granted: -1, consumed: 0, reserved: 0, remaining: 0 } },
      { ...snapshot(), status: "invented" }
    ]) {
      rpc.mockResolvedValueOnce(result);
      await expect(store.status(userId)).rejects.toThrow("IMAGE_LAB_ALLOWANCE_UNAVAILABLE");
    }

    await expect(store.setGlobal({
      target: "enabled",
      enabled: true,
      stage: "object",
      operationId: "bad-global",
      requestHash
    } as never)).rejects.toThrow("IMAGE_LAB_ALLOWANCE_INVALID");
    expect(rpc).toHaveBeenCalledTimes(4);
  });
});
