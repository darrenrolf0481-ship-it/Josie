import { GoogleGenAI } from "@google/genai";

export interface GroundingSource {
  title: string;
  url: string;
  snippet?: string;
  domain?: string;
  publishedDate?: string;
}

export interface GroundingResult {
  searchGrounded: boolean;
  searchQuery: string;
  sources: GroundingSource[];
  formattedContext: string;
  provider: "google" | "web" | "none";
}

/**
 * Extract clean hostname/domain from a URL
 */
function extractDomain(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "web";
  }
}

/**
 * Strip HTML tags and entities from string
 */
function cleanHtmlText(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Primary Web Search Grounding Engine
 */
export async function performSearchGrounding(
  rawQuery: string,
  maxResults: number = 5
): Promise<GroundingResult> {
  const query = rawQuery.trim();
  if (!query) {
    return {
      searchGrounded: false,
      searchQuery: "",
      sources: [],
      formattedContext: "",
      provider: "none",
    };
  }

  const sources: GroundingSource[] = [];
  let usedProvider: "google" | "web" = "web";

  // Tier 1: Try Google GenAI Grounding if API key is present
  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: `Search grounding query: "${query}". Provide a concise factual summary with verified key details.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks && Array.isArray(chunks) && chunks.length > 0) {
        usedProvider = "google";
        for (const chunk of chunks) {
          if (chunk.web?.uri) {
            const url = chunk.web.uri;
            const title = chunk.web.title || extractDomain(url);
            const domain = extractDomain(url);

            if (!sources.some((s) => s.url === url)) {
              sources.push({
                title,
                url,
                domain,
                snippet: response.text ? response.text.slice(0, 240) + "..." : undefined,
              });
            }
          }
          if (sources.length >= maxResults) break;
        }
      }
    } catch (err) {
      console.warn("Google Search Grounding fallback to web crawler:", err);
    }
  }

  // Tier 2: DuckDuckGo HTML + Instant Answer search
  if (sources.length < maxResults) {
    try {
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const ddgRes = await fetch(ddgUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (ddgRes.ok) {
        const html = await ddgRes.text();
        // Match result blocks: <a class="result__url" href="..."> or <a class="result__snippet" ...>
        const resultRegex = /<a class="result__snippet[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        const titleRegex = /<a class="result__url[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

        // Alternative broad match for DuckDuckGo links
        const linkBlockRegex = /<div class="result__body">[\s\S]*?<a class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

        let match;
        while ((match = linkBlockRegex.exec(html)) !== null) {
          let rawUrl = match[1];
          // DuckDuckGo redirects: /l/?uddg=http%3A%2F%2F...
          if (rawUrl.includes("uddg=")) {
            const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
            if (uddgMatch) {
              rawUrl = decodeURIComponent(uddgMatch[1]);
            }
          }

          const title = cleanHtmlText(match[2]);
          const snippet = cleanHtmlText(match[3]);
          const domain = extractDomain(rawUrl);

          if (rawUrl.startsWith("http") && !sources.some((s) => s.url === rawUrl)) {
            sources.push({
              title: title || domain,
              url: rawUrl,
              snippet,
              domain,
            });
          }
          if (sources.length >= maxResults) break;
        }
      }
    } catch (err) {
      console.warn("DuckDuckGo search error:", err);
    }
  }

  // Tier 3: Wikipedia Summary / Knowledge Search fallback
  if (sources.length < maxResults) {
    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        query
      )}&format=json&utf8=1&srlimit=4`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const wikiRes = await fetch(wikiUrl, {
        headers: { "User-Agent": "JOSIE-AI-Interface/1.0" },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (wikiRes.ok) {
        const wikiData = await wikiRes.json();
        const searchItems = wikiData?.query?.search || [];
        for (const item of searchItems) {
          const pageTitle = item.title;
          const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/\s+/g, "_"))}`;
          const snippet = cleanHtmlText(item.snippet);

          if (!sources.some((s) => s.url === url)) {
            sources.push({
              title: `${pageTitle} - Wikipedia`,
              url,
              snippet,
              domain: "wikipedia.org",
            });
          }
          if (sources.length >= maxResults) break;
        }
      }
    } catch (err) {
      console.warn("Wikipedia search fallback error:", err);
    }
  }

  // Format the context injection prompt block
  let formattedContext = "";
  if (sources.length > 0) {
    const formattedSources = sources
      .map(
        (s, idx) =>
          `[${idx + 1}] "${s.title}" (${s.domain})\nURL: ${s.url}${
            s.snippet ? `\nExcerpt: ${s.snippet}` : ""
          }`
      )
      .join("\n\n");

    formattedContext = `[REAL-TIME SEARCH GROUNDING DATA - Retrieved at ${new Date().toUTCString()}]
Search Query: "${query}"
Retrieved Sources (${sources.length}):
${formattedSources}

Instructions for JOSIE:
1. You have access to the real-time live search grounding facts above.
2. Incorporate the latest information and facts directly into your response.
3. Cite source indices like [1], [2] or domain names when making specific factual statements.
4. If there are conflicting claims, explain the nuance clearly.`;
  }

  return {
    searchGrounded: sources.length > 0,
    searchQuery: query,
    sources,
    formattedContext,
    provider: sources.length > 0 ? usedProvider : "none",
  };
}
