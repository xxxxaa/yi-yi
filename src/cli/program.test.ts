import { describe, expect, it } from "vitest";
import { createProgram } from "./program.ts";

describe("CLI program", () => {
  it("has correct name and description", () => {
    const program = createProgram();
    expect(program.name()).toBe("yiyi");
    expect(program.description()).toContain("YiYi");
  });

  it("has gateway subcommand", () => {
    const program = createProgram();
    const gateway = program.commands.find((cmd) => cmd.name() === "gateway");
    expect(gateway).toBeDefined();
  });

  it("outputs help without error", () => {
    const program = createProgram();
    const help = program.helpInformation();
    expect(help).toContain("yiyi");
    expect(help).toContain("gateway");
  });
});
