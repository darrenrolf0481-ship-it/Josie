import { describe, expect, it } from "vitest";
import { evaluateMathExpression } from "../server/math";
import { isPathInside, validateOutboundUrl } from "../server/security";

describe("security helpers", () => {
  it("accepts public HTTP URLs", async () => {
    await expect(validateOutboundUrl("https://example.com")).resolves.toBeInstanceOf(URL);
  });

  it("rejects loopback URLs by default", async () => {
    await expect(validateOutboundUrl("http://127.0.0.1:3000")).rejects.toThrow("Loopback");
  });

  it("allows explicitly enabled local URLs", async () => {
    await expect(validateOutboundUrl("http://127.0.0.1:3000", { allowLoopback: true })).resolves.toBeInstanceOf(URL);
  });

  it("uses path boundaries instead of string prefixes", () => {
    expect(isPathInside("/workspace", "/workspace/src/file.ts")).toBe(true);
    expect(isPathInside("/workspace", "/workspace-other/file.ts")).toBe(false);
    expect(isPathInside("/workspace", "/workspace/../secret")).toBe(false);
  });
});

describe("math expression parser", () => {
  it("supports arithmetic and whitespace", () => {
    expect(evaluateMathExpression("2 + 2 * 3")).toBe(8);
  });

  it("supports legacy Math function syntax", () => {
    expect(evaluateMathExpression("Math.sqrt(144)")).toBe(12);
  });

  it("rejects executable syntax", () => {
    expect(() => evaluateMathExpression("process.exit()" as string)).toThrow();
    expect(() => evaluateMathExpression("1 / 0")).toThrow("Division by zero");
  });
});
