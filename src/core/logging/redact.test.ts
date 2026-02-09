import { describe, expect, it } from "vitest";
import { redactObject, redactSensitive } from "./redact.ts";

describe("redactSensitive", () => {
  it("redacts OpenAI-style API keys", () => {
    expect(redactSensitive("key=sk-abcdefghijklmnopqrstuvwxyz")).toBe("key=[REDACTED]");
  });

  it("redacts Anthropic-style API keys", () => {
    expect(redactSensitive("anthropic-abcdefghijklmnopqrstuvwxyz")).toBe("[REDACTED]");
  });

  it("redacts Bearer tokens", () => {
    expect(redactSensitive("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9")).toBe(
      "Authorization: [REDACTED]",
    );
  });

  it("leaves normal text unchanged", () => {
    expect(redactSensitive("hello world")).toBe("hello world");
  });
});

describe("redactObject", () => {
  it("redacts nested string values", () => {
    const result = redactObject({
      config: { apiKey: "sk-abcdefghijklmnopqrstuvwxyz" },
    });
    expect(result).toEqual({ config: { apiKey: "[REDACTED]" } });
  });

  it("redacts strings in arrays", () => {
    const result = redactObject(["sk-abcdefghijklmnopqrstuvwxyz", "safe"]);
    expect(result).toEqual(["[REDACTED]", "safe"]);
  });

  it("passes through non-string primitives", () => {
    expect(redactObject(42)).toBe(42);
    expect(redactObject(null)).toBe(null);
    expect(redactObject(true)).toBe(true);
  });
});
