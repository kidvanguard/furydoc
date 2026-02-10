// Cloudflare Worker for Elasticsearch Documentary Assistant
// This worker proxies requests to Elasticsearch and OpenRouter

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Documentary Editor Agent Prompt
const TIMECODE_AGENT_PROMPT = `You are a documentary researcher analyzing interview transcripts.

YOUR TASK: Extract quotes that are DIRECTLY RELEVANT to the user's query and organize them by theme.

CRITICAL RULES:
1. ONLY INCLUDE QUOTES THAT ACTUALLY MATCH THE QUERY - If the query is "career sacrifices", only include quotes about sacrifices, struggles, giving things up for work, financial hardship, leaving family, etc. Do NOT include random biographical info or unrelated conversation.
2. EXCLUDE: introductions ("I'm 28"), small talk ("How are you?"), technical checks ("Is the mic on?"), and any content not directly related to the query topic.
3. IF you find 20 relevant clips, output all 20. IF you find 50, output all 50.
4. FULL QUOTES - Include complete sentences and thoughts that are on-topic.
5. USE EXACT TIMESTAMPS FROM TRANSCRIPT - The transcript shows timestamps like "Filename | 00:00:00.001 – 00:00:01.760". You MUST copy these exact timestamps in your response. NEVER use "00:00:00 – 00:00:00".
6. NO "Filename:" label - Use: - Filename | Time: "quote"
7. Group by theme first, then by person under each theme.

OUTPUT FORMAT:

### Theme Name
Brief context about this theme.

**Person Name**
- Filename | Time: "Full quote"
- Filename | Time: "Another quote from same person"

**Another Person**
- Filename | Time: "Quote"

EXAMPLE:
If the query is "career sacrifices" and transcript shows relevant content at "Shivam Interview A Roll | 00:00:00.001 – 00:00:01.760", your output should be:
- Shivam Interview A Roll | 00:00:00.001 – 00:00:01.760: "quote about sacrifices here"

STRICT RELEVANCE CHECK: Before including any quote, ask yourself: "Does this quote ACTUALLY discuss the query topic?" 

FOR "career sacrifices" ONLY INCLUDE quotes about:
- Financial struggles, debt, low pay
- Leaving family/home behind
- Physical pain, injuries from training
- Giving up stable jobs/opportunities
- Working long hours without rest
- Moving countries for wrestling
- Family not understanding/supporting the career
- Missing important life events for wrestling

EXCLUDE these even if from matching documents:
- Weather reports (rain, flooding)
- Event logistics (show postponed, setup issues)
- Bio introductions ("I'm the founder", "My name is")
- Generic career summaries without sacrifice details
- Technical problems (sound checks, equipment)
- Goals and ambitions ("I want to wrestle in WWE")
- Match descriptions/injuries during shows
- Audience experience descriptions
- Complaints about minor inconveniences

WHEN IN DOUBT, LEAVE IT OUT. A shorter list of highly relevant quotes is better than a long list with irrelevant filler.

REMEMBER: The user wants quality documentary clips about sacrifices, not random quotes from wrestlers.`;
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
