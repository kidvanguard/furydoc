// Shared prompts for Documentary Research Assistant
// This file is imported by both the worker and frontend

/**
 * System prompt for the timecode agent - used in chat completions
 * This is the main prompt that guides the LLM's behavior
 */
export const TIMECODE_AGENT_PROMPT = `You are a documentary researcher analyzing interview transcripts.

YOUR TASK: Extract quotes that are DIRECTLY RELEVANT to the user's query and organize them by theme.

CRITICAL RULES:
1. ONLY INCLUDE QUOTES THAT HAVE EMOTIONAL IMPACT - even if they do not use exact keywords from the query - Look for quotes that reveal character depth, show vulnerability, or tell compelling stories. The best quotes often surprise you.
2. EXCLUDE: interviewer questions (the person asking questions is NOT the interview subject), introductions ("I'm 28"), small talk ("How are you?"), technical checks ("Is the mic on?"), and any content not directly related to the query topic.
3. ONLY extract quotes from the INTERVIEW SUBJECT (the person being interviewed), NOT from the interviewer asking questions.
4. IF you find 20 relevant clips, output all 20. IF you find 50, output all 50.
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

EMOTIONAL IMPACT CHECK: Before including any quote, ask yourself: "Does this quote have emotional resonance or tell a compelling story?"

INCLUDE quotes that show:
- Personal struggles, sacrifices, or challenges faced
- Emotional turning points or revelations
- Specific moments with sensory details
- Character revealed through actions and experiences
- Universal themes (identity, belonging, passion, loss)
- Authentic voice and personal perspective

EXCLUDE:
- Weather reports, event logistics, technical problems
- Empty pleasantries and standalone agreement words
- Repetitive statements that don't add new information

WHEN IN DOUBT, INCLUDE IT if it reveals character or has emotional weight. Better to give the user meaningful content they can choose from than to be overly restrictive.

REMEMBER: The user wants COMPELLING quotes that reveal something true about the person. Don't reject good content because it doesn't meet an artificially high "trailer-worthy" bar.`;

/**
 * Prompt for planning search queries based on user's research question
 * Used to generate diverse search terms for finding relevant content
 */
export function getPlanSearchesPrompt(query) {
  return `You are a documentary researcher. The user wants: "${query}"

Your task: Create search terms that will find the MOST INTERESTING and EMOTIONALLY COMPELLING moments, not just literal matches.

GOOD quotes show:
- Personal struggles, sacrifices, or conflicts
- Emotional turning points or revelations
- Unique perspectives or surprising insights
- Character-defining moments
- Vulnerability or authenticity
- Stories with stakes or tension

BAD quotes are:
- Just factual introductions ("My name is...")
- Generic pleasantries
- Technical setup checks
- Repetitive or filler content

Example response for "wrestling passion":
["dream sacrifice", "love wrestling means", "why wrestling emotional", "wrestling identity purpose", "family didn't understand", "risk everything", "wrestling saved me", "obsession devotion"]

Example response for "struggles":
["debt broke money", "injury pain recover", "quit almost gave up", "family反对 objection", "sacrifice left home", "dark times struggle", "failed but kept going"]

Example response for "character moments":
["funny moment laughed", "angry frustrated pissed", "crying emotional", "proud achievement", "regret wish different", "scared nervous afraid"]

Respond with ONLY a JSON array of 6-10 specific, emotionally-focused search terms for: "${query}"`;
}

/**
 * Detects which portion of the transcript the user wants to analyze
 * Returns: 'start' | 'middle' | 'end' | 'all'
 */
function detectQueryPortion(query) {
  const lowerQuery = query.toLowerCase();

  // End/last portion indicators
  if (
    /\b(end|ending|last|final|later|conclusion|wrap up|finish)\b/.test(
      lowerQuery,
    ) ||
    /\b(last \d+ minutes?|final \d+ minutes?)\b/.test(lowerQuery)
  ) {
    return "end";
  }

  // Middle portion indicators
  if (/\b(middle|center|halfway)\b/.test(lowerQuery)) {
    return "middle";
  }

  // Start/beginning indicators
  if (
    /\b(start|beginning|first|early|opening)\b/.test(lowerQuery) ||
    /\b(first \d+ minutes?|opening \d+ minutes?)\b/.test(lowerQuery)
  ) {
    return "start";
  }

  return "all";
}

/**
 * Extracts a specific portion of content based on the query
 */
function extractContentPortion(content, portion, maxLength = 40000) {
  if (content.length <= maxLength || portion === "all") {
    return content.slice(0, maxLength);
  }

  const totalLength = content.length;

  switch (portion) {
    case "start":
      // First portion (already default)
      return content.slice(0, maxLength);

    case "end":
      // Last portion
      return (
        "... [Content skipped from middle] ...\n\n" + content.slice(-maxLength)
      );

    case "middle":
      // Middle portion
      const startPos = Math.floor((totalLength - maxLength) / 2);
      return (
        "... [Beginning skipped] ...\n\n" +
        content.slice(startPos, startPos + maxLength) +
        "\n\n... [End skipped] ..."
      );

    default:
      return content.slice(0, maxLength);
  }
}

/**
 * Builds the final user prompt with search results for the LLM to analyze
 */
export function buildResultsAnalysisPrompt(query, searchResults) {
  // Check if user explicitly wants introductions/bio/background
  const lowerQuery = query.toLowerCase();
  const wantsIntroductions =
    /intro|biography|bio|background|who is|tell me about|describe/.test(
      lowerQuery,
    );
  const wantsTechnical = /tech|setup|audio|mic|sound check|preparation/.test(
    lowerQuery,
  );

  // Detect which portion of the transcript to analyze
  const queryPortion = detectQueryPortion(query);

  let prompt = `QUERY: "${query}"\n\n`;

  if (wantsIntroductions) {
    prompt += `=== QUERY TYPE: INTRODUCTION/BACKGROUND REQUESTED ===\n`;
    prompt += `The user explicitly asked for introductions, biography, or background information.\n`;
    prompt += `Include relevant introductory content, name mentions, role descriptions, and origin stories.\n\n`;
    prompt += `TIMESTAMP RULES:\n`;
    prompt += `- Copy EXACT timestamps from [BRACKETS] below\n`;
    prompt += `- Format: - **Filename** | \`timestamp\`: "Quote"\n\n`;
  } else if (wantsTechnical) {
    prompt += `=== QUERY TYPE: TECHNICAL/SETUP REQUESTED ===\n`;
    prompt += `The user explicitly asked for technical or setup content.\n`;
    prompt += `Include behind-the-scenes moments, audio checks, preparation dialogue.\n\n`;
    prompt += `TIMESTAMP RULES:\n`;
    prompt += `- Copy EXACT timestamps from [BRACKETS] below\n`;
    prompt += `- Format: - **Filename** | \`timestamp\`: "Quote"\n\n`;
  } else {
    prompt += `=== QUOTE SELECTION CRITERIA ===\n\n`;
    prompt += `GOOD QUOTES SHOW:\n`;
    prompt += `- Personal stories with emotional depth (struggles, triumphs, revelations)\n`;
    prompt += `- Specific moments and details (not generic statements)\n`;
    prompt += `- Character revealed through action or experience\n`;
    prompt += `- Authentic voice - how they actually talk, not polished PR speak\n`;
    prompt += `- Narrative arc - beginning, middle, transformation\n`;
    prompt += `- Universal themes (identity, belonging, sacrifice, passion)\n\n`;
    prompt += `ALWAYS EXCLUDE:\n`;
    prompt += `- Interviewer questions (only extract quotes from the person BEING interviewed)\n`;
    prompt += `- Technical checks: "Can you hear me?" / "Is this on?" / "Testing one two"\n`;
    prompt += `- Empty agreements: standalone "Yeah" / "Sure" / "Okay" / "Right"\n`;
    prompt += `- Repetition: Same idea rephrased multiple times\n\n`;
    prompt += `INCLUDE THESE IF THEY TELL A STORY:\n`;
    prompt += `- Introductions that reveal something unique (not just name/age)\n`;
    prompt += `- Job titles IF they explain the meaning behind the role\n`;
    prompt += `- Background IF it has emotional weight or unusual details\n\n`;
    prompt += `EXAMPLES:\n\n`;
    prompt += `QUERY: "career sacrifices"\n\n`;
    prompt += `❌ WEAK: "I'm the owner of Z Afterland Wrestling." (just a label)\n`;
    prompt += `✅ STRONG: "I have about one million debt when I was 19... I spend from that time until now to prove myself to my parents that I can make this a job." (specific stakes, personal struggle)\n\n`;
    prompt += `❌ WEAK: "Yeah, wrestling is my passion." (generic)\n`;
    prompt += `✅ STRONG: "I was forced to watch wrestling since I was two... It feels like wrestling is a big part of our family times." (specific memory, emotional connection)\n\n`;
    prompt += `=== SELECTION GUIDELINES ===\n`;
    prompt += `• Return 5-15 quotes depending on content richness\n`;
    prompt += `• If the file has limited content, return what you find with a note\n`;
    prompt += `• Combine adjacent moments to build complete thoughts\n`;
    prompt += `• Prioritize quotes with emotional resonance and specific details\n\n`;
    prompt += `=== TIMESTAMPS (copy EXACTLY from [BRACKETS] below) ===\n`;
    prompt += `Format: - **Filename** | \`timestamp\`: "Quote"\n`;
    prompt += `WARNING: Invented timestamps will be caught and rejected.\n\n`;
  }

  if (searchResults.hits && searchResults.hits.length > 0) {
    // Group by filename to avoid duplication
    const fileGroups = {};
    searchResults.hits.forEach((hit) => {
      const exactFilename = hit.filename || "Unknown";
      if (!fileGroups[exactFilename]) {
        fileGroups[exactFilename] = [];
      }
      fileGroups[exactFilename].push(hit);
    });

    prompt += `TRANSCRIPT CONTENT (timestamps in [BRACKETS] before each section):\n`;
    prompt += `==========================\n\n`;

    // Add note about which portion is being analyzed
    if (queryPortion !== "all") {
      prompt += `NOTE: Showing ${queryPortion.toUpperCase()} portion of transcript (due to length limits).\n`;
      prompt += `To see other portions, ask for "${queryPortion === "start" ? "end" : "start"} of [filename]"\n\n`;
    }

    Object.entries(fileGroups).forEach(([filename, hits]) => {
      prompt += `FILE: "${filename}"\n`;

      hits.forEach((hit) => {
        const content = hit.content || hit.text || "";
        const timestamp = hit.timestamp || "";

        // Only add timestamp line if we have one
        if (timestamp && timestamp.trim()) {
          prompt += `[${timestamp.trim()}]\n`;
        }

        // Limit content to avoid exceeding LLM token limits
        // Rough estimate: 1 token ≈ 4 characters for English text
        // Target: ~40k tokens max for content = ~160k chars
        const maxLength = 40000;
        const truncatedContent = extractContentPortion(
          content,
          queryPortion,
          maxLength,
        );

        // Format content with proper line breaks
        const lines = truncatedContent.split("\n").filter((l) => l.trim());
        if (lines.length > 0) {
          prompt += lines.join("\n");
          prompt += "\n\n";
        }
      });

      prompt += `---END OF FILE---\n\n`;
    });
  } else {
    prompt += "No search results found.\n";
  }

  return prompt;
}

// Token and chunking utilities for handling long documents

/**
 * Estimates token count from character count
 * Rough estimate: 1 token ≈ 4 characters for English text
 */
export function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/**
 * Splits content into chunks that fit within token limits
 * @param {string} content - The content to chunk
 * @param {number} maxTokensPerChunk - Maximum tokens per chunk (default 100k to leave room for system prompt and output)
 * @param {number} overlapTokens - Overlap between chunks to maintain context (default 2k)
 * @returns {string[]} Array of content chunks
 */
export function chunkContent(
  content,
  maxTokensPerChunk = 100000,
  overlapTokens = 2000,
) {
  const maxCharsPerChunk = maxTokensPerChunk * 4;
  const overlapChars = overlapTokens * 4;

  // If content fits in one chunk, return as-is
  if (content.length <= maxCharsPerChunk) {
    return [content];
  }

  const chunks = [];
  let start = 0;

  while (start < content.length) {
    let end = start + maxCharsPerChunk;

    // If this is the last chunk, just take the rest
    if (end >= content.length) {
      chunks.push(content.slice(start));
      break;
    }

    // Try to find a natural break point (newline or space) near the end
    // Look for newline first
    let breakPoint = content.lastIndexOf("\n\n", end);
    if (breakPoint <= start || breakPoint - start < maxCharsPerChunk * 0.8) {
      // If no good paragraph break, try single newline
      breakPoint = content.lastIndexOf("\n", end);
    }
    if (breakPoint <= start || breakPoint - start < maxCharsPerChunk * 0.8) {
      // If no newline, try space
      breakPoint = content.lastIndexOf(" ", end);
    }
    if (breakPoint <= start) {
      // No natural break found, just cut at max length
      breakPoint = end;
    }

    chunks.push(content.slice(start, breakPoint));

    // Move start forward, including overlap
    start = breakPoint - overlapChars;
    if (start < 0) start = 0;
  }

  return chunks;
}

/**
 * Chunks search results into batches that fit within token limits
 * @param {Object} searchResults - The search results object with hits array
 * @param {number} maxTokensPerChunk - Maximum tokens per chunk
 * @returns {Object[]} Array of search result batches
 */
export function chunkSearchResults(searchResults, maxTokensPerChunk = 100000) {
  if (!searchResults.hits || searchResults.hits.length === 0) {
    return [searchResults];
  }

  const batches = [];
  let currentBatch = { hits: [], total: 0 };
  let currentTokenCount = 0;

  // Maximum tokens per individual hit (to prevent single massive transcripts)
  // Use 20% of chunk size to ensure we can fit multiple hits and leave room for prompt overhead
  const maxTokensPerHit = Math.floor(maxTokensPerChunk * 0.2);
  const maxCharsPerHit = maxTokensPerHit * 4;

  console.log(
    `[chunkSearchResults] Starting with ${searchResults.hits.length} hits, maxTokensPerChunk=${maxTokensPerChunk}, maxTokensPerHit=${maxTokensPerHit}`,
  );

  for (let i = 0; i < searchResults.hits.length; i++) {
    let hit = searchResults.hits[i];
    let hitContent = hit.content || hit.text || "";
    let hitTokens = estimateTokens(hitContent);

    // If this single hit is too large, truncate it
    if (hitTokens > maxTokensPerHit) {
      console.log(
        `[chunkSearchResults] Hit ${i}: Truncating from ${hitTokens} to ~${maxTokensPerHit} tokens (${maxCharsPerHit} chars)`,
      );
      hitContent =
        hitContent.slice(0, maxCharsPerHit) +
        "\n\n[... Content truncated due to length ...]";
      hitTokens = estimateTokens(hitContent);
      // Update the hit with truncated content
      hit = { ...hit, content: hitContent, text: hitContent };
    }

    // If adding this hit would exceed the limit, start a new batch
    // Leave 20% buffer for prompt overhead
    const effectiveLimit = Math.floor(maxTokensPerChunk * 0.8);
    if (
      currentTokenCount + hitTokens > effectiveLimit &&
      currentBatch.hits.length > 0
    ) {
      console.log(
        `[chunkSearchResults] Starting new batch. Previous batch: ${currentBatch.hits.length} hits, ~${currentTokenCount} tokens (limit: ${effectiveLimit})`,
      );
      batches.push(currentBatch);
      currentBatch = { hits: [], total: 0 };
      currentTokenCount = 0;
    }

    currentBatch.hits.push(hit);
    currentBatch.total++;
    currentTokenCount += hitTokens;
  }

  // Don't forget the last batch
  if (currentBatch.hits.length > 0) {
    console.log(
      `[chunkSearchResults] Final batch: ${currentBatch.hits.length} hits, ~${currentTokenCount} tokens`,
    );
    batches.push(currentBatch);
  }

  console.log(`[chunkSearchResults] Created ${batches.length} batches`);
  batches.forEach((batch, idx) => {
    const batchTokens = batch.hits.reduce(
      (sum, h) => sum + estimateTokens(h.content || h.text || ""),
      0,
    );
    console.log(
      `[chunkSearchResults] Batch ${idx + 1}: ${batch.hits.length} hits, ~${batchTokens} tokens`,
    );
  });

  return batches;
}

/**
 * Builds a summary prompt for combining chunk results
 */
export function buildChunkCombinationPrompt(query, chunkResults, totalChunks) {
  let prompt = `You are analyzing a long interview transcript that was split into ${totalChunks} parts due to length.

QUERY: "${query}"

Below are the relevant quotes found from each part of the transcript. Your task is to:
1. Combine and deduplicate similar quotes
2. Organize ALL unique quotes by theme
3. Ensure each theme flows logically
4. Include EVERY meaningful quote - don't summarize away the details

`;

  chunkResults.forEach((result, index) => {
    prompt += `\n=== PART ${index + 1} RESULTS ===\n${result}\n`;
  });

  prompt += `\n=== FINAL OUTPUT ===\n
Provide a comprehensive response that:
- Groups quotes by theme (e.g., "Struggles and Sacrifices", "Passion and Dreams")
- Lists quotes under each person
- Uses the exact format: **Person Name** followed by bullet points with Filename | Time: "Quote"
- Includes ALL unique quotes found across all parts
- Maintains the original timestamps and filenames

If the same quote appears multiple times, include it only once.`;

  return prompt;
}
