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
  DEFAULT_RESULT_SIZE: 50,

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
    searchModeBtn: document.getElementById("search-mode-btn"),

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

  // Search mode toggle
  elements.searchModeBtn.addEventListener("click", () => {
    elements.searchModeBtn.classList.toggle("active");
    const isActive = elements.searchModeBtn.classList.contains("active");
    showToast(
      isActive ? "Search mode enabled" : "Search mode disabled",
      "info",
    );
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

async function sendMessage() {
  const content = elements.messageInput.value.trim();
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
    // Step 1: Search Elasticsearch
    const searchResults = await searchElasticsearch(content);

    // Step 2: Send to OpenRouter with context
    const response = await sendToOpenRouter(content, searchResults);

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
    console.error("Error:", error);
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

function buildPromptWithResults(query, searchResults) {
  let prompt = `User Question: ${query}\n\n`;

  if (searchResults.hits && searchResults.hits.length > 0) {
    prompt += `Search Results (${searchResults.total} total matches):\n\n`;

    searchResults.hits.forEach((hit, index) => {
      const content = hit.content || hit.text || "";
      const truncatedContent =
        content.length > 500 ? content.slice(0, 500) + "..." : content;

      // Ensure filename is preserved exactly as in the .txt file
      const exactFilename = hit.filename || hit.source || "unknown.txt";
      prompt += `[${index + 1}] Source File: "${exactFilename}"\n`;
      if (hit.timestamp) prompt += `Time: ${hit.timestamp}\n`;
      if (hit.speaker) prompt += `Speaker: ${hit.speaker}\n`;
      prompt += `Content: ${truncatedContent}\n\n`;
    });
  } else {
    prompt +=
      "No search results found. Please inform the user that no matches were found in the interview transcripts.\n";
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
  // Escape HTML
  let formatted = escapeHtml(content);

  // Convert URLs to links
  formatted = formatted.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank" rel="noopener" style="color: var(--color-accent); text-decoration: underline;">$1</a>',
  );

  // Convert **bold** to <strong>
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Convert *italic* to <em>
  formatted = formatted.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Convert `code` to <code>
  formatted = formatted.replace(/`(.+?)`/g, "<code>$1</code>");

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
