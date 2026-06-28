import { describe, it, expect, vi, beforeEach } from "vitest";
import { withSupabaseLock } from "../shared/lock.js";

const mockRpc = vi.hoisted(() => vi.fn<(...args: unknown[]) => unknown>());

vi.mock("../lib/supabase.js", () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

describe("withSupabaseLock", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("should acquire lock, run callback, and release lock", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    const callback = vi.fn().mockResolvedValue("result");
    const result = await withSupabaseLock("test-lock", callback);

    expect(result).toBe("result");
    expect(callback).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(mockRpc).toHaveBeenNthCalledWith(1, "acquire_cron_lock", {
      p_name: "test-lock",
      p_instance_id: expect.any(String),
      p_ttl_seconds: 60,
    });
    expect(mockRpc).toHaveBeenNthCalledWith(2, "release_cron_lock", {
      p_name: "test-lock",
      p_instance_id: expect.any(String),
    });
  });

  it("should throw if lock not acquired", async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });

    const callback = vi.fn();
    await expect(
      withSupabaseLock("test-lock", callback, { timeoutMs: 0 }),
    ).rejects.toThrow("Failed to acquire lock");

    expect(callback).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("acquire_cron_lock", {
      p_name: "test-lock",
      p_instance_id: expect.any(String),
      p_ttl_seconds: 60,
    });
  });

  it("should release lock even if callback throws", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    const error = new Error("callback error");
    const callback = vi.fn().mockRejectedValue(error);

    await expect(withSupabaseLock("test-lock", callback)).rejects.toThrow(
      "callback error",
    );

    expect(callback).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(mockRpc).toHaveBeenNthCalledWith(2, "release_cron_lock", {
      p_name: "test-lock",
      p_instance_id: expect.any(String),
    });
  });
});
