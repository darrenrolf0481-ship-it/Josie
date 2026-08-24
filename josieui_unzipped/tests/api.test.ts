import { describe, it, expect } from "vitest";
import {
  extractThoughtsAndContent,
  parseMcpToolCalls,
} from "../src/lib/api";

// Helpers to construct literal XML-like strings that survive tool processing
const T = (inner: string) => `<think>${inner}</think>`;
const TH = (inner: string) => `<thought>${inner}</thought>`;
const OT = (inner: string) => `<think>${inner}`;
const OTH = (inner: string) => `<thought>${inner}`;
const CT = `</think>`;
const CTH = `</thought>`;

describe("extractThoughtsAndContent", () => {
  it("returns empty thought and full content for plain text", () => {
    const result = extractThoughtsAndContent("Hello world");
    expect(result.thought).toBe("");
    expect(result.content).toBe("Hello world");
  });

  it("parses closed think tag", () => {
    const input = `${T("inner monologue")}\nSome text`;
    const result = extractThoughtsAndContent(input);
    expect(result.thought).toBe("inner monologue");
    expect(result.content).toBe("Some text");
  });

  it("parses closed thought tag", () => {
    const input = `${TH("deep reasoning here")}\nFinal answer.`;
    const result = extractThoughtsAndContent(input);
    expect(result.thought).toBe("deep reasoning here");
    expect(result.content).toBe("Final answer.");
  });

  it("parses both think and thought tags together", () => {
    const input = `${T("step one")}\n${TH("refined analysis")}\nConclusion.`;
    const result = extractThoughtsAndContent(input);
    expect(result.thought).toContain("step one");
    expect(result.thought).toContain("refined analysis");
    expect(result.content).toBe("Conclusion.");
  });

  it("handles unclosed think tag (streaming)", () => {
    const input = `${OT("incomplete thought")}`;
    const result = extractThoughtsAndContent(input);
    expect(result.thought).toBe("incomplete thought");
    expect(result.content).toBe("");
  });

  it("handles unclosed thought tag (streaming)", () => {
    const input = `${OTH("partial reasoning")}`;
    const result = extractThoughtsAndContent(input);
    expect(result.thought).toBe("partial reasoning");
    expect(result.content).toBe("");
  });

  it("returns empty for empty string", () => {
    const result = extractThoughtsAndContent("");
    expect(result.thought).toBe("");
    expect(result.content).toBe("");
  });

  it("handles multiple think blocks", () => {
    const input = `${T("First")}\n${T("Second round")}\nFinal.`;
    const result = extractThoughtsAndContent(input);
    expect(result.thought).toBe("First\n\nSecond round");
    expect(result.content).toBe("Final.");
  });

  it("is case-insensitive for tags", () => {
    const input = `<THINK>uppercase thinking</THINK>\nDone.`;
    const result = extractThoughtsAndContent(input);
    expect(result.thought).toBe("uppercase thinking");
    expect(result.content).toBe("Done.");
  });

  it("handles tags with no content between them", () => {
    const input = `${T("")}\nJust hello.`;
    const result = extractThoughtsAndContent(input);
    expect(result.content).toBe("Just hello.");
  });
});

describe("parseMcpToolCalls", () => {
  it("returns empty array for text with no MCP calls", () => {
    const calls = parseMcpToolCalls("Just a normal chat message.");
    expect(calls).toHaveLength(0);
  });

  it("parses a single mcp_call with JSON args", () => {
    const calls = parseMcpToolCalls(
      `<mcp_call tool="calculate_math">{"expression": "2+2"}</mcp_call>`
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].toolName).toBe("calculate_math");
    expect(calls[0].args).toEqual({ expression: "2+2" });
    expect(calls[0].status).toBe("pending");
    expect(calls[0].displayName).toBe("Calculate Math");
  });

  it("parses multiple mcp_calls in the same text", () => {
    const calls = parseMcpToolCalls(
      `<mcp_call tool="execute_code">{"code": "return 1"}</mcp_call>
<mcp_call tool="get_system_vitals">{}</mcp_call>`
    );
    expect(calls).toHaveLength(2);
    expect(calls[0].toolName).toBe("execute_code");
    expect(calls[1].toolName).toBe("get_system_vitals");
    expect(calls[0].displayName).toBe("Execute Code");
    expect(calls[1].displayName).toBe("Get System Vitals");
  });

  it("handles non-JSON args with a raw fallback", () => {
    const calls = parseMcpToolCalls(
      `<mcp_call tool="fetch_url">just some raw text</mcp_call>`
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].toolName).toBe("fetch_url");
    expect(calls[0].args).toEqual({ raw: "just some raw text" });
  });

  it("handles single-quoted tool names", () => {
    const calls = parseMcpToolCalls(
      `<mcp_call tool='mcp_keyval_set'>{"key": "foo", "value": "bar"}</mcp_call>`
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].toolName).toBe("mcp_keyval_set");
    expect(calls[0].args).toEqual({ key: "foo", value: "bar" });
  });

  it("handles multiline mcp_call body", () => {
    const calls = parseMcpToolCalls(`<mcp_call tool="execute_code">{
  "code": "console.log('hi');",
  "timeoutMs": 5000
}</mcp_call>`);
    expect(calls).toHaveLength(1);
    expect(calls[0].args.code).toBe("console.log('hi');");
    expect(calls[0].args.timeoutMs).toBe(5000);
  });

  it("returns empty array for malformed mcp_call (missing tool attr)", () => {
    const calls = parseMcpToolCalls(
      `<mcp_call>{"code": "test"}</mcp_call>`
    );
    expect(calls).toHaveLength(0);
  });
});