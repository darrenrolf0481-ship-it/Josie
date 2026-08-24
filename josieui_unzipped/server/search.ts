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
  provider: "google" | "serper" | "wikipedia" | "none";
}

function extractDomain(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "web";
  }
}

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
 * Tiers: Google GenAI → Serper.dev → Wikipedia
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
  let usedProvider: "google" | "serper" | "wikipedia" = "wikipedia";

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
      console.warn("Google Search Grounding fallback to Serper:", err);
    }
  }

  // Tier 2: Serper.dev Google Search API
  if (sources.length < maxResults && process.env.SERPER_API_KEY) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      let serperRes: Response;
      try {
        serperRes = await fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": process.env.SERPER_API_KEY,
          },
          body: JSON.stringify({ q: query, num: maxResults }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (serperRes.ok) {
        const data = await serperRes.json();
        usedProvider = "serper";

        // Organic search results
        const organic = data?.organic || [];
        for (const result of organic) {
          if (result.link && result.link.startsWith("http")) {
            const domain = extractDomain(result.link);
            if (!sources.some((s) => s.url === result.link)) {
              sources.push({
                title: result.title || domain,
                url: result.link,
                snippet: result.snippet,
                domain,
                publishedDate: result.date,
              });
            }
            if (sources.length >= maxResults) break;
          }
        }

        // Also check knowledge graph if available
        if (sources.length < maxResults && data?.knowledgeGraph) {
          const kg = data.knowledgeGraph;
          if (kg.link && !sources.some((s) => s.url === kg.link)) {
            sources.push({
              title: kg.title || "Knowledge Graph",
              url: kg.link,
              snippet: kg.description,
              domain: extractDomain(kg.link),
            });
          }
        }
      }
    } catch (err) {
      console.warn("Serper search error:", err);
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

      let wikiRes: Response;
      try {
        wikiRes = await fetch(wikiUrl, {
          headers: { "User-Agent": "JOSIE-AI-Interface/1.0" },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

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