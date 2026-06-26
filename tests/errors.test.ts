import { describe, it, expect } from "vitest";
import { getErrorMessage } from "../lib/errors.js";

describe("getErrorMessage", () => {
  it("should return message for Error instance", () => {
    expect(getErrorMessage(new Error("test error"))).toBe("test error");
  });

  it("should return the string itself", () => {
    expect(getErrorMessage("plain string")).toBe("plain string");
  });

  it("should return message property for object with message", () => {
    expect(getErrorMessage({ message: "object message" })).toBe("object message");
  });

  it("should return fallback for null", () => {
    expect(getErrorMessage(null)).toBe("Unknown error");
  });

  it("should return fallback for undefined", () => {
    expect(getErrorMessage(undefined)).toBe("Unknown error");
  });

  it("should return fallback for number", () => {
    expect(getErrorMessage(42)).toBe("Unknown error");
  });

  it("should return custom fallback message", () => {
    expect(getErrorMessage(null, "Custom fallback")).toBe("Custom fallback");
  });
});
