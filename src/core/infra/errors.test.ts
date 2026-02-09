import { describe, expect, it } from "vitest";
import {
  extractErrorCode,
  formatErrorMessage,
  formatUncaughtError,
  toErrorPayload,
} from "./errors.ts";

describe("extractErrorCode", () => {
  it("returns string code from error-like object", () => {
    expect(extractErrorCode({ code: "ENOENT" })).toBe("ENOENT");
  });

  it("returns stringified number code", () => {
    expect(extractErrorCode({ code: 404 })).toBe("404");
  });

  it("returns undefined for non-object", () => {
    expect(extractErrorCode(null)).toBeUndefined();
    expect(extractErrorCode("string")).toBeUndefined();
    expect(extractErrorCode(undefined)).toBeUndefined();
  });

  it("returns undefined when no code property", () => {
    expect(extractErrorCode({ message: "oops" })).toBeUndefined();
  });
});

describe("formatErrorMessage", () => {
  it("formats Error instances", () => {
    expect(formatErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("formats strings directly", () => {
    expect(formatErrorMessage("oops")).toBe("oops");
  });

  it("formats primitives", () => {
    expect(formatErrorMessage(42)).toBe("42");
    expect(formatErrorMessage(true)).toBe("true");
  });

  it("JSON-stringifies objects", () => {
    expect(formatErrorMessage({ key: "val" })).toBe('{"key":"val"}');
  });
});

describe("formatUncaughtError", () => {
  it("returns message for INVALID_CONFIG errors", () => {
    const err = Object.assign(new Error("bad config"), { code: "INVALID_CONFIG" });
    expect(formatUncaughtError(err)).toBe("bad config");
  });

  it("returns stack for regular errors", () => {
    const err = new Error("fail");
    expect(formatUncaughtError(err)).toContain("fail");
    expect(formatUncaughtError(err)).toContain("Error");
  });
});

describe("toErrorPayload", () => {
  it("extracts code and message from coded error", () => {
    const err = Object.assign(new Error("not found"), { code: "NOT_FOUND" });
    expect(toErrorPayload(err)).toEqual({ code: "NOT_FOUND", message: "not found" });
  });

  it("defaults code to INTERNAL for plain errors", () => {
    const result = toErrorPayload(new Error("oops"));
    expect(result.code).toBe("INTERNAL");
    expect(result.message).toBe("oops");
  });

  it("handles non-Error values", () => {
    expect(toErrorPayload("string error")).toEqual({ code: "INTERNAL", message: "string error" });
  });
});
