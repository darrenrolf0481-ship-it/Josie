import { describe, it, expect } from "vitest";
import { extractThoughtsAndContent, parseMcpToolCalls } from "../lib/api";
import { BUILTIN_MCP_TOOLS, executeMcpTool } from "../../server/mcp";

describe("Thought Stream Extraction", () => {
  it("should extract closed <think> blocks correctly", () => {
    const raw = "<think>Analyzing user query...</think>Hello, I am JOSIE!";
    const result = extractThoughtsAndContent(raw);
    expect(result.thought).toBe("Analyzing user query...");
    expect(result.content).toBe("Hello, I am JOSIE!");
  });

  it("should handle streaming unclosed <think> blocks", () => {
    const raw = "<think>Deliberating step 1...";
    const result = extractThoughtsAndContent(raw);
    expect(result.thought).toBe("Deliberating step 1...");
    expect(result.content).toBe("");
  });
});

describe("MCP Tool Parser", () => {
  it("should parse <mcp_call> XML tags into structured tool objects", () => {
    const raw = 'Let me calculate that for you: <mcp_call tool="calculate_math">{"expression": "42 * 2"}</mcp_call>';
    const calls = parseMcpToolCalls(raw);
    expect(calls).toHaveLength(1);
    expect(calls[0].toolName).toBe("calculate_math");
    expect(calls[0].args).toEqual({ expression: "42 * 2" });
  });
});

describe("Builtin MCP Tools Execution", () => {
  it("should evaluate math expressions via calculate_math", async () => {
    const result = await executeMcpTool("calculate_math", { expression: "12 * 12 + 1" });
    expect(result.success).toBe(true);
    expect(result.result.calculated_value).toBe(145);
  });

  it("should execute code in sandbox via execute_code", async () => {
    const result = await executeMcpTool("execute_code", { code: "const x = 10; const y = 20; return x + y;" });
    expect(result.success).toBe(true);
    expect(result.result.return_value).toBe(30);
  });

  it("should have at least 10 builtin tools available", () => {
    expect(BUILTIN_MCP_TOOLS.length).toBeGreaterThanOrEqual(10);
  });
});
