import { spawn } from "node:child_process";

const CHILD_SCRIPT = String.raw`
const vm = require("node:vm");
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  try {
    const request = JSON.parse(input);
    const logs = [];
    const format = (value) => {
      if (typeof value === "object" && value !== null) {
        try { return JSON.stringify(value); } catch { return String(value); }
      }
      return String(value);
    };
    const sandbox = {
      console: {
        log: (...values) => logs.push(values.map(format).join(" ")),
        info: (...values) => logs.push("[INFO] " + values.map(format).join(" ")),
        warn: (...values) => logs.push("[WARN] " + values.map(format).join(" ")),
        error: (...values) => logs.push("[ERROR] " + values.map(format).join(" ")),
      },
      Math, Date, JSON, Array, Object, String, Number, Boolean, RegExp, Map, Set,
      parseInt, parseFloat, isNaN, isFinite,
    };
    const context = vm.createContext(sandbox);
    const source = String(request.code || "");
    const wrapped = source.includes("return")
      ? "(() => {\n" + source + "\n})()"
      : "(() => (" + source + "))()";
    const value = new vm.Script(wrapped, { filename: "mcp-sandbox.js" })
      .runInContext(context, { timeout: Number(request.timeoutMs) || 3000 });
    process.stdout.write(JSON.stringify({ ok: true, value: value === undefined ? null : value, logs }));
  } catch (error) {
    process.stdout.write(JSON.stringify({ ok: false, error: error && error.message ? error.message : String(error) }));
    process.exitCode = 1;
  }
});
`;

const MAX_CODE_BYTES = 100_000;
const MAX_OUTPUT_BYTES = 200_000;

export function runIsolatedCode(code: string, timeoutMs: number): Promise<{ value: any; logs: string[] }> {
  if (Buffer.byteLength(code, "utf8") > MAX_CODE_BYTES) {
    return Promise.reject(new Error("Code input exceeded the 100 KB limit"));
  }

  return new Promise((resolve, reject) => {
    const args = [
      "--experimental-permission",
      "--allow-fs-read=/usr",
      "--no-addons",
      "--disable-proto=throw",
      "--max-old-space-size=128",
      "-e",
      CHILD_SCRIPT,
    ];
    const child = spawn(process.execPath, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { PATH: process.env.PATH || "" },
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      callback();
    };

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() => reject(new Error("Code execution timed out")));
    }, timeoutMs + 500);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
      if (Buffer.byteLength(stdout) > MAX_OUTPUT_BYTES) {
        child.kill("SIGKILL");
        finish(() => reject(new Error("Code execution output exceeded the limit")));
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString().slice(0, 10_000);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      finish(() => reject(error));
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      finish(() => {
        let result: any;
        try {
          result = JSON.parse(stdout);
        } catch {
          reject(new Error(stderr || "Code runner returned invalid output"));
          return;
        }
        if (!result.ok || exitCode !== 0) {
          reject(new Error(result.error || stderr || "Code execution failed"));
          return;
        }
        resolve({ value: result.value, logs: Array.isArray(result.logs) ? result.logs : [] });
      });
    });

    child.stdin.end(JSON.stringify({ code, timeoutMs }));
  });
}
