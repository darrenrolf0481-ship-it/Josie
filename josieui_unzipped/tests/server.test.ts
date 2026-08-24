import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import { createApp } from "../server";
import type { Express } from "express";

let app: Express;

beforeAll(async () => {
  app = await createApp({
    checkRateLimit: vi.fn(() =>
      Promise.resolve({ allowed: true, remaining: 999 })
    ),
  });
}, 15_000);

describe("GET /api/health", () => {
  it("returns ok with timestamp", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
    expect(res.body).toHaveProperty("timestamp");
    expect(res.body).toHaveProperty("service");
  });
});

// ─── MCP Tools endpoint  ───────────────────────────────────────

describe("GET /api/mcp/tools", () => {
  it("returns a list of tools with protocol version", async () => {
    const res = await request(app).get("/api/mcp/tools");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("tools");
    expect(res.body).toHaveProperty("protocol_version");
    expect(res.body).toHaveProperty("capabilities");
    expect(Array.isArray(res.body.tools)).toBe(true);
    expect(res.body.tools.length).toBeGreaterThan(0);

    for (const tool of res.body.tools) {
      expect(tool).toHaveProperty("id");
      expect(tool).toHaveProperty("name");
      expect(tool).toHaveProperty("displayName");
      expect(tool).toHaveProperty("description");
      expect(tool).toHaveProperty("category");
      expect(tool).toHaveProperty("parameters");
      expect(tool).toHaveProperty("enabled");
    }
  });
});

// ─── MCP: execute_code  ─────────────────────────────────────────

describe("POST /api/mcp/execute", () => {
  it("rejects missing toolName", async () => {
    const res = await request(app).post("/api/mcp/execute").send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("toolName");
  });

  it("rejects unknown tool name", async () => {
    const res = await request(app)
      .post("/api/mcp/execute")
      .send({ toolName: "nonexistent_tool", args: {} });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("Unrecognized");
  });

  it("executes calculate_math with a simple expression", async () => {
    const res = await request(app)
      .post("/api/mcp/execute")
      .send({ toolName: "calculate_math", args: { expression: "2 + 2" } });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.result).toBeDefined();
    expect(res.body.result.calculated_value).toBe(4);
    expect(res.body.result.expression).toBe("2 + 2");
    expect(res.body.executionTimeMs).toBeGreaterThan(0);
  });

  it("executes calculate_math with trigonometry", async () => {
    const res = await request(app)
      .post("/api/mcp/execute")
      .send({ toolName: "calculate_math", args: { expression: "Math.sqrt(144)" } });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.result.calculated_value).toBe(12);
  });

  it("execute_code runs JavaScript and captures console.log", async () => {
    const code = `console.log("hello sandbox"); return 42;`;
    const res = await request(app)
      .post("/api/mcp/execute")
      .send({ toolName: "execute_code", args: { code, timeoutMs: 2000 } });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.result.return_value).toBe(42);
    expect(res.body.result.execution_status).toBe("COMPLETED");
    expect(res.body.result.logs).toContain("hello sandbox");
  });

  it("execute_code with implicit return wraps correctly", async () => {
    const code = `[1,2,3].reduce((a,b) => a + b, 0)`;
    const res = await request(app)
      .post("/api/mcp/execute")
      .send({ toolName: "execute_code", args: { code } });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.result.return_value).toBe(6);
  });

  it("execute_code rejects empty code", async () => {
    const res = await request(app)
      .post("/api/mcp/execute")
      .send({ toolName: "execute_code", args: { code: "" } });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("No code");
  });

  it("mcp_keyval_set and mcp_keyval_get round-trip", async () => {
    const setRes = await request(app)
      .post("/api/mcp/execute")
      .send({ toolName: "mcp_keyval_set", args: { key: "test_roundtrip", value: "hello value" } });
    expect(setRes.status).toBe(200);
    expect(setRes.body.success).toBe(true);

    const getRes = await request(app)
      .post("/api/mcp/execute")
      .send({ toolName: "mcp_keyval_get", args: { key: "test_roundtrip" } });
    expect(getRes.status).toBe(200);
    expect(getRes.body.success).toBe(true);
    expect(getRes.body.result.found).toBe(true);
    expect(getRes.body.result.value).toBe("hello value");
  });

  it("mcp_keyval_list returns keys", async () => {
    const res = await request(app)
      .post("/api/mcp/execute")
      .send({ toolName: "mcp_keyval_list", args: {} });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.result).toHaveProperty("total_keys");
    expect(Array.isArray(res.body.result.keys)).toBe(true);
  });

  it("get_system_vitals returns node info", async () => {
    const res = await request(app)
      .post("/api/mcp/execute")
      .send({ toolName: "get_system_vitals", args: { includeOllamaCheck: false } });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.result).toHaveProperty("node_version");
    expect(res.body.result).toHaveProperty("platform");
    expect(res.body.result).toHaveProperty("arch");
    expect(res.body.result).toHaveProperty("uptime_seconds");
    expect(res.body.result).toHaveProperty("memory_rss_mb");
    expect(res.body.result).toHaveProperty("memory_heap_used_mb");
  });

  it("fetch_url rejects invalid URLs", async () => {
    const res = await request(app)
      .post("/api/mcp/execute")
      .send({ toolName: "fetch_url", args: { url: "not-a-valid-url" } });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
  });
});

// ─── Search Grounding endpoint  ─────────────────────────────────

describe("POST /api/search/ground", () => {
  it("returns sources for a real query (Wikipedia fallback)", async () => {
    const res = await request(app)
      .post("/api/search/ground")
      .send({ query: "TypeScript programming language", limit: 3 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("searchGrounded");
    expect(res.body).toHaveProperty("searchQuery", "TypeScript programming language");
    expect(res.body).toHaveProperty("sources");
    expect(res.body).toHaveProperty("provider");

    if (res.body.searchGrounded) {
      expect(res.body.sources.length).toBeGreaterThan(0);
      for (const source of res.body.sources) {
        expect(source).toHaveProperty("title");
        expect(source).toHaveProperty("url");
        expect(source).toHaveProperty("domain");
      }
      expect(res.body).toHaveProperty("formattedContext");
      expect(res.body.formattedContext).toContain("TypeScript");
    }
  });

  it("handles empty query gracefully", async () => {
    const res = await request(app)
      .post("/api/search/ground")
      .send({ query: "", limit: 2 });
    expect(res.status).toBe(200);
    expect(res.body.searchGrounded).toBe(false);
    expect(res.body.sources).toHaveLength(0);
    expect(res.body.provider).toBe("none");
  });
});

// ─── Ollama Status endpoint  ────────────────────────────────────

describe("POST /api/ollama/status", () => {
  it("returns a response even when Ollama is not running", async () => {
    const res = await request(app)
      .post("/api/ollama/status")
      .send({ baseUrl: "http://127.0.0.1:11434" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("connected");
    expect(res.body).toHaveProperty("baseUrl");
  });
});

// ─── MCP custom server test  ────────────────────────────────────

describe("POST /api/mcp/custom-server/test", () => {
  it("rejects missing URL", async () => {
    const res = await request(app)
      .post("/api/mcp/custom-server/test")
      .send({});
    expect(res.status).toBe(400);
  });

  it("returns not connected for invalid host", async () => {
    const res = await request(app)
      .post("/api/mcp/custom-server/test")
      .send({ url: "http://nonexistent.local:9999" });
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(false);
  });
});