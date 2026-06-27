import { describe, it, expect } from "vitest";
import { env } from "../shared/config/env.js";

describe("Environment Config", () => {
  it("should be defined", () => {
    expect(env).toBeDefined();
  });

  it("should have DISCORD_BOT_TOKEN with mock value in test", () => {
    expect(env.DISCORD_BOT_TOKEN).toBe("mock-bot-token");
  });

  it("should have SUPABASE_URL with mock value in test", () => {
    expect(env.SUPABASE_URL).toBe("https://mock.supabase.co");
  });

  it("should have SUPABASE_KEY with mock value in test", () => {
    expect(env.SUPABASE_KEY).toBe("mock-supabase-key");
  });

  it("should have NODE_ENV", () => {
    expect(env.NODE_ENV).toBeDefined();
  });

  it("should have default IKIRU_BASE_URL", () => {
    expect(env.IKIRU_BASE_URL).toBe("https://03.ikiru.wtf");
  });

  it("should respect process.env overrides via Proxy", () => {
    const original = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = "debug";
    expect(env.LOG_LEVEL).toBe("debug");
    process.env.LOG_LEVEL = original;
  });
});
