import dns from "node:dns/promises";
import net from "node:net";
import path from "node:path";

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

export interface OutboundUrlOptions {
  allowLoopback?: boolean;
  allowPrivateNetwork?: boolean;
}

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
}

function isLoopbackAddress(address: string): boolean {
  const normalized = normalizeHostname(address);
  if (net.isIPv4(normalized)) return normalized.startsWith("127.");
  if (net.isIPv6(normalized)) return normalized === "::1" || normalized === "0:0:0:0:0:0:0:1";
  return false;
}

function isRestrictedAddress(address: string): boolean {
  const normalized = normalizeHostname(address);

  if (net.isIPv4(normalized)) {
    const octets = normalized.split(".").map(Number);
    const [a, b] = octets;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168)) ||
      (a === 198 && (b === 18 || b === 19 || b === 51)) ||
      (a === 203 && b === 0) ||
      a >= 224
    );
  }

  if (net.isIPv6(normalized)) {
    const compact = normalized.toLowerCase();
    const mappedIpv4 = compact.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return Boolean(
      compact === "::" ||
        compact === "::1" ||
        compact.startsWith("fc") ||
        compact.startsWith("fd") ||
        compact.startsWith("fe8") ||
        compact.startsWith("fe9") ||
        compact.startsWith("fea") ||
        compact.startsWith("feb") ||
        compact.startsWith("ff") ||
        (mappedIpv4 && isRestrictedAddress(mappedIpv4[1]))
    );
  }

  return false;
}

/** Validate a URL and resolve its hostname before making an outbound request. */
export async function validateOutboundUrl(
  input: string,
  options: OutboundUrlOptions = {}
): Promise<URL> {
  if (typeof input !== "string" || input.length === 0 || input.length > 2048) {
    throw new UnsafeUrlError("A URL between 1 and 2048 characters is required");
  }

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new UnsafeUrlError("Invalid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UnsafeUrlError("Only HTTP and HTTPS URLs are supported");
  }
  if (parsed.username || parsed.password) {
    throw new UnsafeUrlError(" URLs with embedded credentials are not allowed");
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost")) {
    if (!options.allowLoopback) {
      throw new UnsafeUrlError("Loopback URLs are not allowed");
    }
    return parsed;
  }

  const addresses = net.isIP(hostname)
    ? [hostname]
    : (await dns.lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address);

  for (const address of addresses) {
    if (isLoopbackAddress(address) && !options.allowLoopback) {
      throw new UnsafeUrlError("Loopback network targets are not allowed");
    }
    if (
      isRestrictedAddress(address) &&
      !options.allowPrivateNetwork &&
      !(isLoopbackAddress(address) && options.allowLoopback)
    ) {
      throw new UnsafeUrlError("Private or restricted network targets are not allowed");
    }
  }

  return parsed;
}

/** Fetch while validating every redirect target instead of allowing implicit redirects. */
export async function fetchSafe(
  input: string,
  init: RequestInit = {},
  options: OutboundUrlOptions = {},
  maxRedirects = 3
): Promise<Response> {
  let current = await validateOutboundUrl(input, options);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const response = await fetch(current, { ...init, redirect: "manual" });
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }

    const location = response.headers.get("location");
    if (!location) return response;
    if (redirectCount === maxRedirects) {
      throw new UnsafeUrlError("Too many outbound redirects");
    }

    current = await validateOutboundUrl(new URL(location, current).toString(), options);
  }

  throw new UnsafeUrlError("Unable to follow outbound request");
}

export function isPathInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

export interface ValidatedChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export function validateChatMessages(value: unknown): value is ValidatedChatMessage[] {
  if (!Array.isArray(value) || value.length > 100) return false;
  return value.every((message) => {
    if (!message || typeof message !== "object") return false;
    const candidate = message as Record<string, unknown>;
    return (
      (candidate.role === "user" || candidate.role === "assistant" || candidate.role === "system") &&
      typeof candidate.content === "string" &&
      candidate.content.length <= 200_000
    );
  });
}

export function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? Math.min(Math.max(numberValue, min), max) : fallback;
}

export function allowPrivateNetworkTargets(): boolean {
  return process.env.ALLOW_PRIVATE_NETWORK_TARGETS === "true";
}

export function allowLocalMcpTargets(): boolean {
  return process.env.ALLOW_LOCAL_MCP_TARGETS === "true";
}

export function allowRemoteOllamaTargets(): boolean {
  return process.env.ALLOW_REMOTE_OLLAMA_TARGETS === "true";
}

export function isLoopbackUrl(input: string): boolean {
  try {
    const parsed = new URL(input);
    const hostname = normalizeHostname(parsed.hostname);
    return hostname === "localhost" || hostname.endsWith(".localhost") || isLoopbackAddress(hostname);
  } catch {
    return false;
  }
}

export async function validateOllamaUrl(input: string): Promise<URL> {
  const parsed = await validateOutboundUrl(input, {
    allowLoopback: true,
    allowPrivateNetwork: allowPrivateNetworkTargets(),
  });
  if (!allowRemoteOllamaTargets() && !isLoopbackUrl(parsed.toString())) {
    throw new UnsafeUrlError("Remote Ollama targets require ALLOW_REMOTE_OLLAMA_TARGETS=true");
  }
  return parsed;
}
