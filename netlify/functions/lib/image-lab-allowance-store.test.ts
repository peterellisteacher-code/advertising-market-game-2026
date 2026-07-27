// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import {
  SupabaseImageLabAllowanceStore,
  type ImageLabAllowanceSnapshot
} from "./image-lab-allowance-store";

const userId = "b9b32e20-0ba8-4896-b89f-44efdfc52942";
const secondUserId = "99250725-52e0-44c9-b569-593167786eaf";
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
    const store = new SupabaseImageLabAllowanceStore({
      imageLabRpc: rpc,
      imageLabTeacherRpc: vi.fn()
    });

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
    const store = new SupabaseImageLabAllowanceStore({
      imageLabRpc: rpc,
      imageLabTeacherRpc: vi.fn()
    });

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
    const store = new SupabaseImageLabAllowanceStore({
      imageLabRpc: rpc,
      imageLabTeacherRpc: vi.fn()
    });
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

  it("sends each teacher UI action through one atomic broker call", async () => {
    const teacherRpc = vi.fn().mockImplementation(async (input: {
      userIds: readonly string[];
    }) => ({
      ...snapshot(),
      accounts: input.userIds.map((accountUserId) => ({
        userId: accountUserId,
        object: snapshot().object,
        realise: snapshot().realise
      }))
    }));
    const store = new SupabaseImageLabAllowanceStore({
      imageLabRpc: vi.fn(),
      imageLabTeacherRpc: teacherRpc
    });
    const base = {
      object: 3,
      realise: 1,
      operationId: "teacher-action:1",
      requestHash
    };

    await expect(store.teacherMutate({
      ...base,
      ledgerOperation: "set_global",
      userIds: [],
      enabled: true
    })).resolves.toEqual({
      snapshot: snapshot(),
      accounts: []
    });
    await expect(store.teacherMutate({
      ...base,
      ledgerOperation: "set",
      userIds: [userId]
    })).resolves.toMatchObject({
      accounts: [{ userId }]
    });
    await expect(store.teacherMutate({
      ...base,
      ledgerOperation: "batch_add",
      userIds: [userId, secondUserId]
    })).resolves.toMatchObject({
      accounts: [{ userId }, { userId: secondUserId }]
    });

    expect(teacherRpc.mock.calls.map(([input]) => input)).toEqual([
      {
        ...base,
        ledgerOperation: "set_global",
        userIds: [],
        enabled: true
      },
      {
        ...base,
        ledgerOperation: "set",
        userIds: [userId]
      },
      {
        ...base,
        ledgerOperation: "batch_add",
        userIds: [userId, secondUserId]
      }
    ]);
  });

  it("rejects malformed teacher mutation input and mismatched account results", async () => {
    const teacherRpc = vi.fn().mockResolvedValue({
      ...snapshot(),
      accounts: [{
        userId: secondUserId,
        object: snapshot().object,
        realise: snapshot().realise
      }]
    });
    const store = new SupabaseImageLabAllowanceStore({
      imageLabRpc: vi.fn(),
      imageLabTeacherRpc: teacherRpc
    });

    await expect(store.teacherMutate({
      ledgerOperation: "set",
      userIds: [userId],
      object: 3,
      realise: 1,
      operationId: "teacher-action:1",
      requestHash
    })).rejects.toThrow("IMAGE_LAB_ALLOWANCE_UNAVAILABLE");
    await expect(store.teacherMutate({
      ledgerOperation: "batch_add",
      userIds: [userId, userId],
      object: 1,
      realise: 0,
      operationId: "teacher-action:2",
      requestHash
    })).rejects.toThrow("IMAGE_LAB_ALLOWANCE_INVALID");
    expect(teacherRpc).toHaveBeenCalledOnce();
  });
});
