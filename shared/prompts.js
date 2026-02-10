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

    Object.entries(fileGroups).forEach(([filename, hits]) => {
      prompt += `FILE: "${filename}"\n`;

      hits.forEach((hit) => {
        const content = hit.content || hit.text || "";
        const timestamp = hit.timestamp || "";

        // Only add timestamp line if we have one
        if (timestamp && timestamp.trim()) {
          prompt += `[${timestamp.trim()}]\n`;
        }

        // For full documents, include much more content (up to 50k chars)
        // For search result snippets, limit to 5000 chars
        const isFullDocument = content.length > 10000;
        const maxLength = isFullDocument ? 50000 : 5000;
        const truncatedContent =
          content.length > maxLength
            ? content.slice(0, maxLength) + "..."
            : content;

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
