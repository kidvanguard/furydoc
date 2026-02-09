// Documentary Research Assistant - Main Application
// Features: Password protection, multi-tab chat, ES search, OpenRouter integration

const CONFIG = {
  // Password for access (simple shared password - not high security but keeps casual visitors out)
  ACCESS_PASSWORD: "documentary2024",

  // Default settings
  DEFAULT_WORKER_URL:
    "https://documentary-research-assistant.furydoc.workers.dev",
  DEFAULT_ES_INDEX: "furytranscripts",
  DEFAULT_MODEL: "deepseek/deepseek-chat",
  DEFAULT_TEMPERATURE: 0.7,
  DEFAULT_RESULT_SIZE: 100,

  // Local storage keys
  STORAGE_KEY: "docu-research-chats",
  SETTINGS_KEY: "docu-research-settings",
  AUTH_KEY: "docu-research-authed",
};

// Application State
const state = {
  isAuthenticated: false,
  currentChatId: null,
  chats: [],
  settings: {},
  isLoading: false,
  currentMessages: [],
};

// DOM Elements
let elements = {};

// Initialize app
document.addEventListener("DOMContentLoaded", () => {
  initElements();
  loadSettings();
  loadChats();
  checkAuth();
  setupEventListeners();
  setupKeyboardShortcuts();

  // Set default model
  elements.modelSelector.value = CONFIG.DEFAULT_MODEL;
});

function initElements() {
  elements = {
    // Password gate
    passwordGate: document.getElementById("password-gate"),
    passwordInput: document.getElementById("password-input"),
    passwordSubmit: document.getElementById("password-submit"),
    passwordError: document.getElementById("password-error"),

    // Main app
    app: document.getElementById("app"),

    // Header
    newChatBtn: document.getElementById("new-chat-btn"),
    exportBtn: document.getElementById("export-btn"),
    settingsBtn: document.getElementById("settings-btn"),

    // Sidebar
    chatTabs: document.getElementById("chat-tabs"),
    clearAllBtn: document.getElementById("clear-all-btn"),

    // Chat
    messages: document.getElementById("messages"),
    messageInput: document.getElementById("message-input"),
    sendBtn: document.getElementById("send-btn"),
    charCount: document.getElementById("char-count"),
    modelSelector: document.getElementById("model-selector"),

    // Settings modal
    settingsModal: document.getElementById("settings-modal"),
    workerUrlInput: document.getElementById("worker-url"),
    esIndexInput: document.getElementById("es-index"),
    temperatureInput: document.getElementById("temperature"),
    tempValue: document.getElementById("temp-value"),
    resultSizeInput: document.getElementById("result-size"),
    saveSettingsBtn: document.getElementById("save-settings"),

    // Export modal
    exportModal: document.getElementById("export-modal"),

    // Toast
    toastContainer: document.getElementById("toast-container"),
  };
}

function checkAuth() {
  const authed = localStorage.getItem(CONFIG.AUTH_KEY);
  if (authed === "true") {
    state.isAuthenticated = true;
    showApp();
  }
}

function setupEventListeners() {
  // Password gate
  elements.passwordSubmit.addEventListener("click", handlePasswordSubmit);
  elements.passwordInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handlePasswordSubmit();
  });

  // Chat
  elements.newChatBtn.addEventListener("click", createNewChat);
  elements.sendBtn.addEventListener("click", (e) => {
    console.log("Send button clicked");
    e.preventDefault();
    e.stopPropagation();
    sendMessage();
  });
  elements.messageInput.addEventListener("input", handleInput);
  elements.messageInput.addEventListener("keydown", (e) => {
    // Send on Enter (without shift for new line)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Settings
  elements.settingsBtn.addEventListener("click", () =>
    openModal(elements.settingsModal),
  );
  elements.saveSettingsBtn.addEventListener("click", saveSettings);
  elements.temperatureInput.addEventListener("input", (e) => {
    elements.tempValue.textContent = e.target.value;
  });

  // Export
  elements.exportBtn.addEventListener("click", () =>
    openModal(elements.exportModal),
  );
  document.querySelectorAll(".export-btn").forEach((btn) => {
    btn.addEventListener("click", () => exportConversation(btn.dataset.format));
  });

  // Clear all
  elements.clearAllBtn.addEventListener("click", clearAllChats);

  // Example buttons
  document.querySelectorAll(".example-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      elements.messageInput.value = btn.dataset.query;
      elements.messageInput.focus();
      handleInput();
    });
  });

  // Close modals
  document.querySelectorAll(".modal-close").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const modal = e.target.closest(".modal");
      closeModal(modal);
    });
  });

  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal(modal);
    });
  });
}

function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Cmd/Ctrl + N = New Chat
    if ((e.metaKey || e.ctrlKey) && e.key === "n") {
      e.preventDefault();
      createNewChat();
    }

    // Esc = Close modals
    if (e.key === "Escape") {
      document.querySelectorAll(".modal").forEach(closeModal);
    }
  });
}

// Authentication
function handlePasswordSubmit() {
  const input = elements.passwordInput.value;
  if (input === CONFIG.ACCESS_PASSWORD) {
    state.isAuthenticated = true;
    localStorage.setItem(CONFIG.AUTH_KEY, "true");
    showApp();
  } else {
    elements.passwordError.style.display = "block";
    elements.passwordInput.value = "";
    elements.passwordInput.focus();
  }
}

function showApp() {
  elements.passwordGate.classList.add("gate-hidden");
  elements.app.style.display = "flex";

  if (state.chats.length === 0) {
    createNewChat();
  } else {
    loadChat(state.chats[0].id);
  }

  renderTabs();
}

// Chat Management
function createNewChat() {
  const id = Date.now().toString();
  const chat = {
    id,
    title: `Chat ${state.chats.length + 1}`,
    messages: [],
    createdAt: new Date().toISOString(),
    model: elements.modelSelector.value,
  };

  state.chats.unshift(chat);
  state.currentChatId = id;
  state.currentMessages = [];

  saveChats();
  renderTabs();
  renderMessages();

  elements.messageInput.focus();
}

function loadChat(id) {
  const chat = state.chats.find((c) => c.id === id);
  if (!chat) return;

  state.currentChatId = id;
  state.currentMessages = [...chat.messages];

  if (chat.model) {
    elements.modelSelector.value = chat.model;
  }

  renderTabs();
  renderMessages();
}

function deleteChat(id, event) {
  event.stopPropagation();

  state.chats = state.chats.filter((c) => c.id !== id);

  if (state.currentChatId === id) {
    if (state.chats.length > 0) {
      loadChat(state.chats[0].id);
    } else {
      createNewChat();
    }
  } else {
    renderTabs();
  }

  saveChats();
}

function clearAllChats() {
  if (confirm("Are you sure you want to clear all conversations?")) {
    state.chats = [];
    createNewChat();
    saveChats();
  }
}

// Messaging
function handleInput() {
  const length = elements.messageInput.value.length;
  elements.charCount.textContent = `${length}/2000`;
  elements.sendBtn.disabled = length === 0 || state.isLoading;

  // Auto-resize textarea
  elements.messageInput.style.height = "auto";
  elements.messageInput.style.height =
    Math.min(elements.messageInput.scrollHeight, 200) + "px";
}

// Define related search themes for proactive searching
const THEME_SEARCHES = {
  "career sacrifices": [
    "money financial",
    "family wife husband",
    "left home moved",
    "struggle hard difficult",
    "training physical pain",
    "job work quit",
  ],
  sacrifices: [
    "money financial",
    "family wife husband",
    "left home moved",
    "struggle hard difficult",
    "training physical pain",
    "job work quit",
  ],
  money: ["financial debt cost", "pay rent eat", "broke struggle", "job work"],
  financial: ["money pay", "debt cost", "broke struggle", "job work income"],
  family: [
    "wife husband partner",
    "parents mother father",
    "kids children",
    "relationship",
  ],
  wife: ["husband partner", "family", "relationship", "home"],
  husband: ["wife partner", "family", "relationship", "home"],
  struggle: [
    "hard difficult challenge",
    "problem obstacle",
    "money financial",
    "physical pain injury",
  ],
  thailand: ["bangkok", "pattaya", "moved here", "living here", "asia"],
  pattaya: ["thailand", "bangkok", "living here", "moved here"],
  bangkok: ["thailand", "pattaya", "living here", "moved here"],
  training: ["gym workout", "practice", "physical pain", "learning"],
  wrestling: ["wrestler", "match", "fight", "training", "promotion"],
  character: ["personality", "who is", "background", "story"],
  personality: ["character", "who is", "background", "story"],
  experience: ["background", "history", "journey", "story"],
  journey: ["experience", "background", "came here", "started"],
  "why wrestling": ["dream", "passion", "love", "why", "reason"],
  dream: ["passion", "goal", "want to", "ambition"],
  passion: ["dream", "love", "why", "obsession"],
  "first match": ["debut", "started", "beginning", "nervous"],
  debut: ["first match", "started", "beginning"],
  future: ["plan", "goal", "want to", "next"],
  plan: ["future", "goal", "want to", "next"],
  goal: ["future", "plan", "want to", "dream"],
  nervous: ["scared", "afraid", "first time", "worry"],
  scared: ["nervous", "afraid", "fear", "worry"],
  travel: ["flew", "came here", "international", "different country"],
  international: ["travel", "overseas", "different country", "came here"],
  home: ["family", "wife", "husband", "left", "back home"],
};

function getRelatedSearches(query) {
  const lowerQuery = query.toLowerCase();

  // Check for exact matches first
  for (const [key, searches] of Object.entries(THEME_SEARCHES)) {
    if (lowerQuery.includes(key)) {
      return searches;
    }
  }

  // For any other query, do intelligent expansions based on keywords
  const expansions = [];

  // Check for common keywords and add relevant expansions
  if (lowerQuery.match(/\b(wrestle|fight|match|ring|show)\b/)) {
    expansions.push("training", "gym", "match", "promotion");
  }
  if (lowerQuery.match(/\b(come|came|move|moved|travel|here)\b/)) {
    expansions.push("thailand", "pattaya", "bangkok", "moved here");
  }
  if (lowerQuery.match(/\b(feel|think|believe|opinion)\b/)) {
    expansions.push("passion", "dream", "love", "why");
  }
  if (lowerQuery.match(/\b(hard|difficult|tough|struggle|problem)\b/)) {
    expansions.push("struggle", "challenge", "money", "financial");
  }
  if (lowerQuery.match(/\b(wife|husband|family|home|kid)\b/)) {
    expansions.push("family", "wife", "husband", "left home");
  }
  if (lowerQuery.match(/\b(money|pay|cost|debt|broke)\b/)) {
    expansions.push("financial", "money", "job", "work");
  }
  if (lowerQuery.match(/\b(start|begin|first|started)\b/)) {
    expansions.push("first match", "debut", "training", "began");
  }
  if (lowerQuery.match(/\b(future|plan|goal|next|want)\b/)) {
    expansions.push("future", "plan", "goal", "dream");
  }

  // If no specific expansions found, add some general ones
  if (expansions.length === 0) {
    return ["experience", "background", "story", "journey"];
  }

  return [...new Set(expansions)]; // Remove duplicates
}

async function planSearches(query) {
  console.log("[DEBUG] planSearches called with query:", query);
  // Ask LLM to plan what searches to run
  const planPrompt = `You are a documentary researcher. The user wants to find: "${query}"

Your task: Determine what search terms would find the best material for this request.

For example:
- "trailer moments" → exciting, dramatic, emotional highlights
- "career sacrifices" → money, family, leaving home, struggles
- "funny moments" → jokes, laughs, humorous stories
- "character introductions" → who they are, background, personality

Respond with ONLY a JSON array of 4-8 search terms. Be specific and varied.

Example response for "trailer moments":
["dramatic exciting", "emotional touching", "fighting action", "victory celebration", "struggle overcome", "dream passion", "never give up", "epic moment"]

Example response for "career sacrifices":
["money financial", "left family home", "struggle hard", "physical pain injury", "quit job", "training sacrifice", "moved to thailand", "debt broke"]

Now respond with JSON array for: "${query}"`;

  try {
    console.log("[DEBUG] Sending plan request to LLM...");
    const response = await fetch(`${state.settings.workerUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: planPrompt }],
        model: elements.modelSelector.value,
        temperature: 0.7,
      }),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const content = data.content || "";

    // Extract JSON array from response
    const match = content.match(/\[[^\]]+\]/);
    if (match) {
      return JSON.parse(match[0]);
    }
    return [];
  } catch (e) {
    console.error("Search planning failed:", e);
    return [];
  }
}

async function sendMessage() {
  const content = elements.messageInput.value.trim();
  console.log("[DEBUG] sendMessage called with:", content);
  if (!content || state.isLoading) return;

  // Check if worker URL is configured
  if (!state.settings.workerUrl) {
    showToast("Please configure Worker URL in settings first", "error");
    openModal(elements.settingsModal);
    return;
  }

  // Add user message
  const userMessage = {
    id: Date.now().toString(),
    role: "user",
    content,
    timestamp: new Date().toISOString(),
  };

  state.currentMessages.push(userMessage);

  // Update chat
  const chat = state.chats.find((c) => c.id === state.currentChatId);
  if (chat) {
    chat.messages = [...state.currentMessages];
    chat.model = elements.modelSelector.value;
    if (chat.title.startsWith("Chat ") && state.currentMessages.length === 1) {
      chat.title = content.slice(0, 30) + (content.length > 30 ? "..." : "");
    }
  }

  saveChats();
  renderMessages();
  renderTabs();

  // Clear input
  elements.messageInput.value = "";
  handleInput();

  // Show loading
  state.isLoading = true;
  elements.sendBtn.disabled = true;
  showThinking();

  try {
    // Step 1: Ask LLM to plan the searches
    showToast("Planning searches with AI...", "info");
    const plannedSearches = await planSearches(content);
    console.log("[DEBUG] Planned searches:", plannedSearches);

    // Also get related searches from our predefined list
    const relatedSearches = getRelatedSearches(content);
    console.log("[DEBUG] Related searches:", relatedSearches);

    // Combine and deduplicate
    const allSearches = [
      ...new Set([content, ...plannedSearches, ...relatedSearches]),
    ];

    console.log("[DEBUG] Running searches:", allSearches);
    showToast(`Running ${allSearches.length} searches...`, "info");

    // Step 2: Run all searches
    const allResults = { hits: [], total: 0 };
    const seenFiles = new Set();

    for (const searchTerm of allSearches) {
      console.log(`[DEBUG] Searching: "${searchTerm}"`);
      try {
        const results = await searchElasticsearch(searchTerm);
        console.log(
          `[DEBUG] Found ${results.hits?.length || 0} hits for "${searchTerm}"`,
        );
        for (const hit of results.hits || []) {
          // Extract filename from hit - check field first, then extract from content
          let filename = hit.filename || "unknown";
          if (!filename || filename === "Unknown" || filename === "unknown") {
            // Try to extract from content (format: "Filename: Name\n\n" or "Name\n\n1\n")
            const content = hit.content || hit.text || "";
            const filenameMatch = content.match(/Filename:\s*([^\n]+)/i);
            if (filenameMatch) {
              filename = filenameMatch[1].trim();
            } else {
              // Try first non-empty line before timestamp
              const lines = content.split("\n").filter((l) => l.trim());
              if (lines.length > 0 && !lines[0].match(/^\d+\s*$/)) {
                filename = lines[0].trim();
              }
            }
          }
          if (!seenFiles.has(filename)) {
            seenFiles.add(filename);
            allResults.hits.push(hit);
            allResults.total++;
          } else {
            console.log(`[DEBUG] Skipping duplicate file: ${filename}`);
          }
        }
      } catch (e) {
        console.error(`[DEBUG] Search failed for "${searchTerm}":`, e);
      }
    }

    console.log(`[DEBUG] Total unique results: ${allResults.total}`);
    console.log(
      "[DEBUG] Files found:",
      allResults.hits.map((h) => h.filename),
    );
    showToast(`Found ${allResults.total} clips, analyzing...`, "info");

    // Step 3: Send to OpenRouter for final organization
    const promptPreview = buildPromptWithResults(content, allResults).slice(
      0,
      500,
    );
    console.log("[DEBUG] Prompt preview (first 500 chars):", promptPreview);

    const response = await sendToOpenRouter(content, allResults);
    console.log("[DEBUG] LLM response length:", response.length);
    console.log(
      "[DEBUG] LLM response preview (first 500 chars):",
      response.slice(0, 500),
    );

    // Add assistant message
    const assistantMessage = {
      id: Date.now().toString(),
      role: "assistant",
      content: response,
      timestamp: new Date().toISOString(),
      model: elements.modelSelector.value,
    };

    state.currentMessages.push(assistantMessage);

    // Update chat
    if (chat) {
      chat.messages = [...state.currentMessages];
    }

    saveChats();
    renderMessages();
  } catch (error) {
    console.error("[DEBUG] Error in sendMessage:", error);
    showToast(`Error: ${error.message}`, "error");

    // Remove user message on error
    state.currentMessages.pop();
    if (chat) {
      chat.messages = [...state.currentMessages];
    }
    saveChats();
    renderMessages();
  } finally {
    state.isLoading = false;
    elements.sendBtn.disabled = elements.messageInput.value.length === 0;
    removeThinking();
  }
}

async function searchElasticsearch(query) {
  const response = await fetch(`${state.settings.workerUrl}/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      index: state.settings.esIndex || CONFIG.DEFAULT_ES_INDEX,
      size: parseInt(state.settings.resultSize) || CONFIG.DEFAULT_RESULT_SIZE,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Search failed");
  }

  return await response.json();
}

async function sendToOpenRouter(query, searchResults) {
  // Build conversation context
  const messages = [
    ...state.currentMessages.slice(0, -1), // Previous messages (excluding the one we just added)
    {
      role: "user",
      content: buildPromptWithResults(query, searchResults),
    },
  ];

  const response = await fetch(`${state.settings.workerUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      model: elements.modelSelector.value,
      temperature:
        parseFloat(state.settings.temperature) || CONFIG.DEFAULT_TEMPERATURE,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Chat failed");
  }

  const data = await response.json();
  return data.content;
}

// Helper function to extract filename from hit
function extractFilename(hit) {
  let filename = hit.filename || "unknown";
  if (!filename || filename === "Unknown" || filename === "unknown") {
    const content = hit.content || hit.text || "";
    const filenameMatch = content.match(/Filename:\s*([^\n]+)/i);
    if (filenameMatch) {
      filename = filenameMatch[1].trim();
    } else {
      const lines = content.split("\n").filter((l) => l.trim());
      if (lines.length > 0 && !lines[0].match(/^\d+\s*$/)) {
        filename = lines[0].trim();
      }
    }
  }
  return filename;
}

function buildPromptWithResults(query, searchResults) {
  let prompt = `QUERY: ${query}\n\n`;
  prompt += `INSTRUCTIONS FOR CHATBOT:\n`;
  prompt += `- Extract quotes relevant to: ${query}\n`;
  prompt += `- Use format: - Filename | Time: "Full quote here"\n`;
  prompt += `- NO "Filename:" label, NO summaries in parentheses\n`;
  prompt += `- Include full sentences, not fragments\n\n`;

  if (searchResults.hits && searchResults.hits.length > 0) {
    // Group by person first to help the LLM
    const personGroups = {};
    searchResults.hits.forEach((hit) => {
      const exactFilename = extractFilename(hit);
      const speakerMatch = exactFilename.match(
        /^(\w+)\s+(?:Interview|talking|tours?|hosting|outside|at|with|can't)/i,
      );
      const speaker = speakerMatch ? speakerMatch[1] : hit.speaker || "Unknown";

      if (!personGroups[speaker]) {
        personGroups[speaker] = [];
      }
      personGroups[speaker].push(hit);
    });

    prompt += `TRANSCRIPT CONTENT:\n\n`;

    Object.entries(personGroups).forEach(([speaker, hits]) => {
      prompt += `--- ${speaker} ---\n`;
      hits.forEach((hit, idx) => {
        const content = hit.content || hit.text || "";
        const exactFilename = extractFilename(hit);
        // More content - 1000 chars to find better quotes
        const truncatedContent =
          content.length > 1000 ? content.slice(0, 1000) + "..." : content;

        prompt += `${exactFilename}`;
        if (hit.timestamp) prompt += ` | ${hit.timestamp}`;
        prompt += `\n${truncatedContent}\n\n`;
      });
    });
  } else {
    prompt += "No search results found.\n";
  }

  return prompt;
}

// Rendering
function renderTabs() {
  elements.chatTabs.innerHTML = "";

  state.chats.forEach((chat) => {
    const tab = document.createElement("div");
    tab.className = `chat-tab ${chat.id === state.currentChatId ? "active" : ""}`;
    tab.innerHTML = `
      <span class="chat-tab-title">${escapeHtml(chat.title)}</span>
      <button class="chat-tab-close" title="Delete chat">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    tab.addEventListener("click", () => loadChat(chat.id));
    tab
      .querySelector(".chat-tab-close")
      .addEventListener("click", (e) => deleteChat(chat.id, e));

    elements.chatTabs.appendChild(tab);
  });
}

function renderMessages() {
  elements.messages.innerHTML = "";

  if (state.currentMessages.length === 0) {
    elements.messages.innerHTML = `
      <div class="welcome-message">
        <div class="welcome-icon">🎬</div>
        <h2>Welcome to Documentary Research Assistant</h2>
        <p>Search through your interview transcripts using natural language.</p>
        <div class="example-queries">
          <p>Try asking:</p>
          <div class="examples">
            <button class="example-btn" data-query="wrestling experience">"wrestling experience"</button>
            <button class="example-btn" data-query="Thailand and Pattaya">"Thailand and Pattaya"</button>
            <button class="example-btn" data-query="career sacrifices">"career sacrifices"</button>
            <button class="example-btn" data-query="Wam Bam character">"Wam Bam character"</button>
          </div>
        </div>
      </div>
    `;

    // Re-attach example button listeners
    document.querySelectorAll(".example-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        elements.messageInput.value = btn.dataset.query;
        elements.messageInput.focus();
        handleInput();
      });
    });

    return;
  }

  state.currentMessages.forEach((msg, index) => {
    const messageEl = document.createElement("div");
    messageEl.className = `message ${msg.role}`;
    messageEl.innerHTML = `
      <div class="message-avatar">${msg.role === "user" ? "👤" : "🤖"}</div>
      <div class="message-content">
        <div class="message-header">
          <span class="message-author">${msg.role === "user" ? "You" : "Assistant"}</span>
          <span class="message-time">${formatTime(msg.timestamp)}</span>
          <div class="message-actions">
            <button class="message-action-btn" title="Copy" data-index="${index}" data-action="copy">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            ${
              msg.role === "assistant"
                ? `
              <button class="message-action-btn" title="Regenerate" data-index="${index}" data-action="regenerate">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <polyline points="1 20 1 14 7 14"></polyline>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
              </button>
            `
                : ""
            }
          </div>
        </div>
        <div class="message-body">${formatMessage(msg.content)}</div>
      </div>
    `;

    elements.messages.appendChild(messageEl);
  });

  // Attach action listeners
  document.querySelectorAll(".message-action-btn").forEach((btn) => {
    btn.addEventListener("click", handleMessageAction);
  });

  scrollToBottom();
}

function showThinking() {
  const thinkingEl = document.createElement("div");
  thinkingEl.className = "message assistant thinking";
  thinkingEl.id = "thinking-indicator";
  thinkingEl.innerHTML = `
    <div class="message-avatar">🤖</div>
    <div class="message-content">
      <div class="thinking-indicator">
        <div class="thinking-dot"></div>
        <div class="thinking-dot"></div>
        <div class="thinking-dot"></div>
      </div>
    </div>
  `;
  elements.messages.appendChild(thinkingEl);
  scrollToBottom();
}

function removeThinking() {
  const thinking = document.getElementById("thinking-indicator");
  if (thinking) thinking.remove();
}

function handleMessageAction(e) {
  const btn = e.currentTarget;
  const action = btn.dataset.action;
  const index = parseInt(btn.dataset.index);
  const message = state.currentMessages[index];

  switch (action) {
    case "copy":
      navigator.clipboard.writeText(message.content).then(() => {
        showToast("Copied to clipboard!", "success");
      });
      break;
    case "regenerate":
      regenerateResponse(index);
      break;
  }
}

async function regenerateResponse(index) {
  // Remove the assistant message and subsequent messages
  state.currentMessages = state.currentMessages.slice(0, index);

  const chat = state.chats.find((c) => c.id === state.currentChatId);
  if (chat) {
    chat.messages = [...state.currentMessages];
  }

  saveChats();
  renderMessages();

  // Get the last user message
  const lastUserMessage =
    state.currentMessages[state.currentMessages.length - 1];
  if (!lastUserMessage || lastUserMessage.role !== "user") return;

  // Retry the search and response
  state.isLoading = true;
  elements.sendBtn.disabled = true;
  showThinking();

  try {
    const searchResults = await searchElasticsearch(lastUserMessage.content);
    const response = await sendToOpenRouter(
      lastUserMessage.content,
      searchResults,
    );

    const assistantMessage = {
      id: Date.now().toString(),
      role: "assistant",
      content: response,
      timestamp: new Date().toISOString(),
      model: elements.modelSelector.value,
    };

    state.currentMessages.push(assistantMessage);

    if (chat) {
      chat.messages = [...state.currentMessages];
    }

    saveChats();
    renderMessages();
    showToast("Response regenerated!", "success");
  } catch (error) {
    showToast(`Error: ${error.message}`, "error");
  } finally {
    state.isLoading = false;
    elements.sendBtn.disabled = elements.messageInput.value.length === 0;
    removeThinking();
  }
}

// Settings
function loadSettings() {
  const saved = localStorage.getItem(CONFIG.SETTINGS_KEY);
  console.log("Loading settings from localStorage:", saved);

  // Always start with defaults
  state.settings = {
    workerUrl: CONFIG.DEFAULT_WORKER_URL,
    esIndex: CONFIG.DEFAULT_ES_INDEX,
    temperature: CONFIG.DEFAULT_TEMPERATURE,
    resultSize: CONFIG.DEFAULT_RESULT_SIZE,
  };

  // Merge saved settings (only if they have values)
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed.workerUrl) state.settings.workerUrl = parsed.workerUrl;
    if (parsed.esIndex) state.settings.esIndex = parsed.esIndex;
    if (parsed.temperature !== undefined)
      state.settings.temperature = parsed.temperature;
    if (parsed.resultSize) state.settings.resultSize = parsed.resultSize;
  }

  console.log("Loaded settings:", state.settings);
  // Apply to inputs
  elements.workerUrlInput.value = state.settings.workerUrl;
  console.log("Set worker URL input to:", elements.workerUrlInput.value);
  elements.esIndexInput.value =
    state.settings.esIndex || CONFIG.DEFAULT_ES_INDEX;
  elements.temperatureInput.value =
    state.settings.temperature || CONFIG.DEFAULT_TEMPERATURE;
  elements.tempValue.textContent =
    state.settings.temperature || CONFIG.DEFAULT_TEMPERATURE;
  elements.resultSizeInput.value =
    state.settings.resultSize || CONFIG.DEFAULT_RESULT_SIZE;
}

function saveSettings() {
  state.settings = {
    workerUrl: elements.workerUrlInput.value.trim(),
    esIndex: elements.esIndexInput.value.trim() || CONFIG.DEFAULT_ES_INDEX,
    temperature: elements.temperatureInput.value,
    resultSize: elements.resultSizeInput.value,
  };

  localStorage.setItem(CONFIG.SETTINGS_KEY, JSON.stringify(state.settings));
  closeModal(elements.settingsModal);
  showToast("Settings saved!", "success");
}

// Chat persistence
function loadChats() {
  const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
  state.chats = saved ? JSON.parse(saved) : [];
}

function saveChats() {
  localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state.chats));
}

// Export
function exportConversation(format) {
  const chat = state.chats.find((c) => c.id === state.currentChatId);
  if (!chat || chat.messages.length === 0) {
    showToast("No conversation to export", "warning");
    return;
  }

  let content, filename, mimeType;

  switch (format) {
    case "markdown":
      content = exportAsMarkdown(chat);
      filename = `chat-${chat.id}.md`;
      mimeType = "text/markdown";
      break;
    case "json":
      content = JSON.stringify(chat, null, 2);
      filename = `chat-${chat.id}.json`;
      mimeType = "application/json";
      break;
    case "text":
      content = exportAsText(chat);
      filename = `chat-${chat.id}.txt`;
      mimeType = "text/plain";
      break;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  closeModal(elements.exportModal);
  showToast(`Exported as ${format}!`, "success");
}

function exportAsMarkdown(chat) {
  let md = `# ${chat.title}\n\n`;
  md += `Date: ${new Date(chat.createdAt).toLocaleString()}\n\n`;
  md += `---\n\n`;

  chat.messages.forEach((msg) => {
    const role = msg.role === "user" ? "You" : "Assistant";
    const time = new Date(msg.timestamp).toLocaleTimeString();
    md += `## ${role} (${time})\n\n${msg.content}\n\n---\n\n`;
  });

  return md;
}

function exportAsText(chat) {
  let text = `${chat.title}\n`;
  text += `${new Date(chat.createdAt).toLocaleString()}\n`;
  text += "=".repeat(50) + "\n\n";

  chat.messages.forEach((msg) => {
    const role = msg.role === "user" ? "You" : "Assistant";
    const time = new Date(msg.timestamp).toLocaleTimeString();
    text += `[${role} - ${time}]\n${msg.content}\n\n`;
  });

  return text;
}

// Utilities
function openModal(modal) {
  modal.style.display = "flex";
}

function closeModal(modal) {
  modal.style.display = "none";
}

function scrollToBottom() {
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatMessage(content) {
  // First handle markdown before escaping HTML
  let formatted = content;

  // Convert headers (####, ###, ##, #) - MUST process longer patterns first
  formatted = formatted.replace(
    /^####\s*(.+)$/gim,
    '<h4 style="margin: 12px 0 8px 0; color: var(--color-text); font-size: 1.1em;">$1</h4>',
  );
  formatted = formatted.replace(
    /^###\s*(.+)$/gim,
    '<h3 style="margin: 16px 0 8px 0; color: var(--color-text); border-bottom: 1px solid var(--color-border); padding-bottom: 4px; font-size: 1.2em;">$1</h3>',
  );
  formatted = formatted.replace(
    /^##\s*(.+)$/gim,
    '<h2 style="margin: 20px 0 10px 0; color: var(--color-text); font-size: 1.4em;">$1</h2>',
  );
  formatted = formatted.replace(
    /^#\s*(.+)$/gim,
    '<h1 style="margin: 24px 0 12px 0; color: var(--color-text); font-size: 1.6em;">$1</h1>',
  );

  // Convert **bold** to <strong>
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Convert list items (- or *) at start of line to list items
  // Handle both standalone lines and lines after headers
  formatted = formatted.replace(/^[\*\-]\s+(.+)$/gm, "<li>$1</li>");

  // Wrap consecutive li elements in ul
  formatted = formatted.replace(
    /(<li>.+<\/li>(?:\s|<br>)*)/g,
    "<ul style='margin: 8px 0; padding-left: 20px;'>$1</ul>",
  );

  // Now escape HTML in remaining text (not in tags we just created)
  // Split by HTML tags and escape text between them
  const parts = formatted.split(/(<[^>]+>)/g);
  formatted = parts
    .map((part, i) => {
      if (i % 2 === 0) {
        // Text content - escape it
        return escapeHtml(part);
      }
      // HTML tag - keep as is
      return part;
    })
    .join("");

  // Convert URLs to links (after escaping)
  formatted = formatted.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener" style="color: var(--color-accent); text-decoration: underline;">$1</a>',
  );

  // Convert newlines to <br> for remaining text
  formatted = formatted.replace(/\n/g, "<br>");

  return formatted;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-message">${escapeHtml(message)}</span>
  `;

  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Make functions available globally for inline handlers
window.regenerateResponse = regenerateResponse;
