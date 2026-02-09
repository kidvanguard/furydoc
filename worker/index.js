// Cloudflare Worker for Elasticsearch Documentary Assistant
// This worker proxies requests to Elasticsearch and OpenRouter

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Documentary Editor Agent Prompt
const TIMECODE_AGENT_PROMPT = `EXTRACT QUOTES FROM TRANSCRIPTS AND ORGANIZE BY THEMES WITH CONTEXT.

OUTPUT FORMAT - GROUP BY THEME THEN BY PERSON:

### Theme Name (e.g., Financial Sacrifices, Leaving Home, Physical Toll)
Brief context about what this theme represents.

**Person Name**
- Filename | Time: "Full quote here"
- Filename | Time: "Another quote"

**Another Person**
- Filename | Time: "Quote about this theme"

### Another Theme
Context for this theme.

**Person Name**
- Filename | Time: "Quote"

RULES:
1. GROUP BY THEME FIRST - Create 3-5 thematic sections (Financial, Family, Physical, Relocation, etc.)
2. ADD CONTEXT - Write 1-2 sentences explaining each theme
3. THEN GROUP BY PERSON - Under each theme, list people with their quotes
4. SKIP INTRODUCTIONS - "Hi my name is", "I'm 28" - NOT sacrifices
5. FULL SENTENCES - Include complete thoughts
6. NO "Filename:" WORD - Just: - Shivam Interview | 00:00:01: "quote"
7. MANY RESULTS - Include all relevant quotes

EXAMPLE FOR "CAREER SACRIFICES":

### Leaving Everything Behind
Wrestlers who relocated to Thailand, leaving family, jobs, and familiar lives.

**Shivam**
- Shivam Interview A Roll | 00:00:10 – 00:00:25: "I left my family back home, gave up my job, moved across the world just to wrestle here"

**Wam Bam Bellows**
- Wam Bam Interview A Roll | 00:00:49 – 00:00:59: "Started training in 2004... in 2014 I started going overseas for traveling and wrestling"

### Financial Struggles
The economic reality of pursuing wrestling without stable income.

**Shivam**
- Shivam Interview A Roll | 00:01:15 – 00:01:30: "The hardest part is the money, you know? Sometimes I don't know how I'm gonna eat but I keep training"

### Building the Scene (Organizational Challenges)
The struggle to establish wrestling in a new country with limited resources.

**Sunny**
- Sunny can't find wrestlers | 00:00:05 – 00:00:20: "My biggest struggle is finding wrestlers right now. I train in Canada, at least every school has so many students"

FILTER: Skip biographical info (name, age, where from) unless it illustrates a sacrifice`;

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/api/search" && request.method === "POST") {
        return await handleSearch(request, env);
      }

      if (path === "/api/chat" && request.method === "POST") {
        return await handleChat(request, env);
      }

      if (path === "/api/models" && request.method === "GET") {
        return handleGetModels(env);
      }

      return new Response("Not Found", {
        status: 404,
        headers: CORS_HEADERS,
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
    const esQuery = {
      query: {
        multi_match: {
          query: query,
          fields: ["attachment.content^3", "filename", "speaker"],
          type: "best_fields",
          fuzziness: "AUTO",
        },
      },
      size: size,
      highlight: {
        fields: {
          "attachment.content": {},
        },
      },
    };

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
