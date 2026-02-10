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

EMOTIONAL IMPACT CHECK: Before including any quote, ask yourself: "Does this quote ACTUALLY discuss the query topic?" 

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

WHEN IN DOUBT, INCLUDE IT if it has emotional resonance. A shorter list of highly relevant quotes is better than a long list with irrelevant filler.

REMEMBER: The user wants EMOTIONALLY COMPELLING quotes that would work in a documentary trailer.`;

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
    prompt += `=== DOCUMENTARY EDITOR DIRECTIVE ===\n`;
    prompt += `You are selecting quotes for a FEATURE DOCUMENTARY. These will appear on screen. Every quote must be TRAILER-WORTHY.\n\n`;
    prompt += `THE BAR IS HIGH:\n`;
    prompt += `- Would this quote make a stranger CARE about this person in 10 seconds?\n`;
    prompt += `- Does it reveal something unexpected about human nature?\n`;
    prompt += `- Would you remember it tomorrow?\n\n`;
    prompt += `REQUIRED ELEMENTS (must check at least 3 boxes):\n`;
    prompt += `☐ NARRATIVE ARC - Beginning, middle, END (transformation/resolution)\n`;
    prompt += `☐ EMOTIONAL RAWNESS - Fear, shame, triumph, grief, longing (not just "happy")\n`;
    prompt += `☐ SPECIFIC SENSORY DETAILS - Numbers, colors, physical sensations, exact moments\n`;
    prompt += `☐ SUBVERSION - Challenges expectations or reveals hidden truth\n`;
    prompt += `☐ UNIVERSAL STAKES - Life/death, love/loss, identity, belonging\n`;
    prompt += `☐ AUTHENTIC MESSINESS - Interrupts self, uses wrong words, laughs mid-cry\n\n`;
    prompt += `=== AUTOMATIC REJECTION LIST ===\n`;
    prompt += `These will NEVER make the cut. Skip them entirely:\n\n`;
    prompt += `🚫 JOB TITLES: "I'm the founder/owner/director/president of..."\n`;
    prompt += `🚫 NAME/AGE ORIGIN: "My name is..." / "I'm 28 years old from..."\n`;
    prompt += `🚫 TECH CHECKS: "Can you hear me?" / "Is this on?" / "Testing one two"\n`;
    prompt += `🚫 EMPTY AGREEMENT: "Yeah" / "Sure" / "Okay" / "Right" / "Exactly" (alone)\n`;
    prompt += `🚫 SOCIAL PLATITUDES: "Follow your dreams" / "Never give up" (generic)\n`;
    prompt += `🚫 PROMO MENTIONS: Social handles, website URLs, "check us out"\n`;
    prompt += `🚫 SURFACE BIO: "I started wrestling 5 years ago" (fact without story)\n`;
    prompt += `🚫 REPETITION: Same idea rephrased slightly differently\n\n`;
    prompt += `=== GOLD STANDARD EXAMPLES ===\n\n`;
    prompt += `QUERY: "career sacrifices"\n\n`;
    prompt += `❌ REJECT: "I'm the owner of Z Afterland Wrestling."\n`;
    prompt += `   Why: Just a label. Zero emotion. Anyone could say this.\n\n`;
    prompt += `✅ SELECT: "I remember sitting in my car outside the bank, holding the foreclosure notice. My daughter's gymnastics photo was on the dashboard. I thought: 'I'm either going to lose this house or I'm going to lose my mind trying to save it.' So I started the wrestling school in my garage the next morning."\n`;
    prompt += `   Why: Specific moment (car, bank, photo), emotional stakes (house vs sanity), transformation (decision to act), sensory details (holding paper, dashboard photo)\n\n`;
    prompt += `❌ REJECT: "Yeah, wrestling is my passion. I've always loved it."\n`;
    prompt += `   Why: Generic. Could be about anything. No story, no stakes.\n\n`;
    prompt += `✅ SELECT: "The doctor said I'd never wrestle again after the third concussion. I lied to my wife about the headaches. Lied to my kids about why I was crying in the shower. Then I found a doctor who'd clear me and I was back in the ring three months later. I don't know if that makes me dedicated or broken. Probably both."\n`;
    prompt += `   Why: Conflict (medical vs desire), moral complexity (lying to family), self-awareness (dedicated or broken?), specific details (third concussion, three months)\n\n`;
    prompt += `=== SELECTION CRITERIA ===\n`;
    prompt += `• Pick 3-5 quotes MAXIMUM. Better to return 2 incredible quotes than 7 mediocre ones.\n`;
    prompt += `• If you find NOTHING that meets the bar, say: "No trailer-worthy quotes found in this file."\n`;
    prompt += `• Combine adjacent moments if needed to build a complete arc.\n`;
    prompt += `• Prioritize quotes where the person contradicts themselves, reveals hypocrisy, or admits something shameful.\n\n`;
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

        // Include up to 1500 chars to give more context
        const truncatedContent =
          content.length > 1500 ? content.slice(0, 1500) + "..." : content;

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
