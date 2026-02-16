// Cloudflare Worker for Elasticsearch Documentary Assistant
// This worker proxies requests to Elasticsearch and OpenRouter

import { TIMECODE_AGENT_PROMPT } from "../shared/prompts.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Route requests
      if (path === "/api/search" && request.method === "POST") {
        return await handleSearch(request, env);
      }

      if (path === "/api/document" && request.method === "POST") {
        return await handleGetDocument(request, env);
      }

      if (path === "/api/chat" && request.method === "POST") {
        return await handleChat(request, env);
      }

      if (path === "/api/models" && request.method === "GET") {
        return await handleGetModels(env);
      }

      // Health check
      if (path === "/" || path === "/health") {
        return new Response(
          JSON.stringify({ status: "ok", message: "Cybersyn API is running" }),
          {
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Worker error:", error);
      return new Response(
        JSON.stringify({ error: error.message, stack: error.stack }),
        {
          status: 500,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json",
          },
        },
      );
    }
  },
};

async function handleSearch(request, env) {
  try {
    const {
      query,
      index = "furytranscripts",
      size = 50,
      filename = null,
    } = await request.json();

    if (!query) {
      return new Response(JSON.stringify({ error: "Query required" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Check if env vars are set
    if (!env.ELASTICSEARCH_ENDPOINT) {
      return new Response(
        JSON.stringify({ error: "ELASTICSEARCH_ENDPOINT not configured" }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }
    if (!env.ELASTICSEARCH_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ELASTICSEARCH_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    // Build Elasticsearch query - furytranscripts uses attachment.content
    let esQuery;

    if (filename) {
      // If filename is specified, use exact match on filename
      // and only search content (not filename field to avoid cross-contamination)
      esQuery = {
        query: {
          bool: {
            must: {
              multi_match: {
                query: query,
                fields: ["attachment.content^3", "speaker"],
                type: "best_fields",
                fuzziness: "AUTO",
              },
            },
            filter: {
              match: {
                filename: filename,
              },
            },
          },
        },
        size: size,
        _source: [
          "filename",
          "speaker",
          "timestamp",
          "start_time",
          "attachment.content",
        ],
        highlight: {
          fields: {
            "attachment.content": {
              fragment_size: 1000,
              number_of_fragments: 20,
            },
          },
        },
      };
    } else {
      // Regular search without filename filter
      esQuery = {
        query: {
          multi_match: {
            query: query,
            fields: ["attachment.content^3", "filename", "speaker"],
            type: "best_fields",
            fuzziness: "AUTO",
          },
        },
        size: size,
        _source: [
          "filename",
          "speaker",
          "timestamp",
          "start_time",
          "attachment.content",
        ],
        highlight: {
          fields: {
            "attachment.content": {
              fragment_size: 1000,
              number_of_fragments: 20,
            },
          },
        },
      };
    }

    const esUrl = `${env.ELASTICSEARCH_ENDPOINT}/${index}/_search`;
    console.log("Searching Elasticsearch:", esUrl);

    const response = await fetch(esUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `ApiKey ${env.ELASTICSEARCH_API_KEY}`,
      },
      body: JSON.stringify(esQuery),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Elasticsearch error:", response.status, errorText);
      return new Response(
        JSON.stringify({
          error: `Elasticsearch error: ${response.status} - ${errorText}`,
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    const data = await response.json();

    // Format results - furytranscripts uses attachment.content
    const hits = data.hits.hits.map((hit) => ({
      filename: hit._source.filename || "Unknown",
      content:
        hit._source.attachment?.content ||
        hit._source.content ||
        hit._source.text ||
        "",
      timestamp: hit._source.timestamp || hit._source.start_time || "",
      speaker: hit._source.speaker || "",
      score: hit._score,
      highlights: hit.highlight,
    }));

    return new Response(
      JSON.stringify({
        hits: hits,
        total: data.hits.total?.value || data.hits.total || 0,
        query: query,
      }),
      {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("handleSearch error:", error);
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  }
}

async function handleGetDocument(request, env) {
  try {
    const { filename, index = "furytranscripts" } = await request.json();

    if (!filename) {
      return new Response(JSON.stringify({ error: "Filename required" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (!env.ELASTICSEARCH_ENDPOINT || !env.ELASTICSEARCH_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Elasticsearch not configured" }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    // Search for ALL chunks of this document by filename
    // Documents may be split into multiple records, so we fetch up to 100 chunks
    const esQuery = {
      query: {
        term: {
          filename: filename,
        },
      },
      size: 100, // Fetch up to 100 chunks
      sort: [{ timestamp: "asc" }, { start_time: "asc" }], // Sort chronologically
      _source: [
        "filename",
        "speaker",
        "timestamp",
        "start_time",
        "attachment.content",
      ],
    };

    const esUrl = `${env.ELASTICSEARCH_ENDPOINT}/${index}/_search`;
    console.log("Fetching document chunks:", filename);

    const response = await fetch(esUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `ApiKey ${env.ELASTICSEARCH_API_KEY}`,
      },
      body: JSON.stringify(esQuery),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Elasticsearch error:", response.status, errorText);
      return new Response(
        JSON.stringify({
          error: `Elasticsearch error: ${response.status} - ${errorText}`,
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    const data = await response.json();

    if (data.hits.hits.length === 0) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Concatenate all chunks into a single document
    let fullContent = "";
    let firstHit = data.hits.hits[0];

    for (const hit of data.hits.hits) {
      const chunkContent =
        hit._source.attachment?.content || hit._source.content || "";
      if (chunkContent) {
        fullContent += chunkContent + "\n";
      }
    }

    console.log(
      `Fetched ${data.hits.hits.length} chunks, total content: ${fullContent.length} chars`,
    );

    return new Response(
      JSON.stringify({
        filename: firstHit._source.filename,
        content: fullContent,
        speaker: firstHit._source.speaker || "",
        timestamp:
          firstHit._source.timestamp || firstHit._source.start_time || "",
        chunks: data.hits.hits.length,
      }),
      {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("handleGetDocument error:", error);
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  }
}

async function handleChat(request, env) {
  try {
    const {
      messages,
      model = "anthropic/claude-3.5-sonnet",
      temperature = 0.7,
    } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Messages array required" }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    if (!env.OPENROUTER_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENROUTER_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    // Construct system message with timecode agent prompt
    const systemMessage = {
      role: "system",
      content: TIMECODE_AGENT_PROMPT,
    };

    // Extract search results from the last user message if present
    let conversationMessages = [systemMessage];

    // Add conversation history (skipping the system message pattern)
    for (const msg of messages) {
      if (msg.role !== "system") {
        conversationMessages.push(msg);
      }
    }

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://github.com",
          "X-Title": "Documentary Research Assistant",
        },
        body: JSON.stringify({
          model: model,
          messages: conversationMessages,
          temperature: temperature,
          max_tokens: 4000,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter error:", response.status, errorText);
      return new Response(
        JSON.stringify({
          error: `OpenRouter error: ${response.status} - ${errorText}`,
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    const data = await response.json();

    // Check if OpenRouter returned an error
    if (data.error) {
      console.error("OpenRouter API error:", JSON.stringify(data.error));
      return new Response(
        JSON.stringify({
          error: "AI service error",
          details: data.error.message || data.error.code || "Unknown error",
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    // Check if response has expected format
    if (
      !data.choices ||
      !Array.isArray(data.choices) ||
      data.choices.length === 0
    ) {
      console.error(
        "Unexpected OpenRouter response - no choices:",
        JSON.stringify(data).slice(0, 2000),
      );
      return new Response(
        JSON.stringify({
          error: "Unexpected response from AI service",
          details: "Response missing choices array",
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    if (!data.choices[0].message || !data.choices[0].message.content) {
      console.error(
        "Unexpected OpenRouter response - no message content:",
        JSON.stringify(data.choices[0]).slice(0, 1000),
      );
      return new Response(
        JSON.stringify({
          error: "Unexpected response from AI service",
          details: "Response missing message content",
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        content: data.choices[0].message.content,
        model: model,
        usage: data.usage,
      }),
      {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("handleChat error:", error);
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  }
}

async function handleGetModels(env) {
  // Return curated list of popular models
  const models = [
    {
      id: "anthropic/claude-3.5-sonnet",
      name: "Claude 3.5 Sonnet",
      provider: "Anthropic",
    },
    {
      id: "anthropic/claude-3.5-haiku",
      name: "Claude 3.5 Haiku",
      provider: "Anthropic",
    },
    { id: "openai/gpt-4o", name: "GPT-4o", provider: "OpenAI" },
    { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI" },
    {
      id: "google/gemini-flash-1.5",
      name: "Gemini Flash 1.5",
      provider: "Google",
    },
    { id: "google/gemini-pro-1.5", name: "Gemini Pro 1.5", provider: "Google" },
    {
      id: "meta-llama/llama-3.1-70b-instruct",
      name: "Llama 3.1 70B",
      provider: "Meta",
    },
    {
      id: "meta-llama/llama-3.1-8b-instruct",
      name: "Llama 3.1 8B",
      provider: "Meta",
    },
    { id: "deepseek/deepseek-chat", name: "DeepSeek V3", provider: "DeepSeek" },
    {
      id: "mistralai/mistral-large",
      name: "Mistral Large",
      provider: "Mistral",
    },
  ];

  return new Response(JSON.stringify({ models }), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
