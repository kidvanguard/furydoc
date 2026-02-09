# 🎬 Documentary Research Assistant

A password-protected chat interface for searching Elasticsearch interview transcripts using natural language, powered by OpenRouter AI models.

## ✨ Features

- 🔒 **Password Protection** - Simple shared password gate
- 💬 **Multi-Tab Chat** - Multiple concurrent conversations
- 🤖 **AI Model Selection** - Choose from Claude, GPT-4o, Gemini, and more
- 🔍 **Elasticsearch Integration** - Search your interview transcripts
- 📤 **Export Conversations** - Markdown, JSON, or plain text
- 📋 **Copy & Regenerate** - Message-level actions
- ⚙️ **Customizable Settings** - Temperature, result count, index name
- ⌨️ **Keyboard Shortcuts** - `Cmd/Ctrl+N` for new chat, `Esc` to close modals

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  GITHUB PAGES (Static Frontend)                                  │
│  ├── Password Gate (client-side)                                 │
│  └── Rich Chat Interface (HTML/CSS/JS)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  CLOUDFLARE WORKER (Backend Proxy)                               │
│  ├── /api/search → Queries Elasticsearch                         │
│  ├── /api/chat → Formats results with timecode agent prompt      │
│  └── Sends to OpenRouter (Claude/GPT-4o/Gemini/etc.)            │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
┌─────────────────────────┐         ┌─────────────────────────┐
│  ELASTICSEARCH          │         │  OPENROUTER API         │
│  (Your Interview Data)  │         │  (AI Model Provider)    │
└─────────────────────────┘         └─────────────────────────┘
```

## 🚀 Quick Start

### 1. Deploy Cloudflare Worker

```bash
# Install dependencies (if needed)
npm install -g wrangler

# Run deployment script
chmod +x deploy.sh
./deploy.sh
```

This will:

- Prompt for your API keys
- Store them as encrypted secrets
- Deploy the worker globally
- Provide you with a Worker URL

### 2. Configure GitHub Pages

```bash
# Initialize git repository
git init
git add .
git commit -m "Initial commit"

# Push to GitHub
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main

# Enable GitHub Pages in repository settings
```

### 3. Configure the App

1. Open your deployed GitHub Pages site
2. Enter password
3. Click ⚙️ Settings button
4. Paste your Worker URL
5. Set your Elasticsearch index name (default: `subtitles`)
6. Start chatting!

## 🔧 Configuration

### Environment Variables (Cloudflare Worker Secrets)

| Variable                 | Description                                                  |
| ------------------------ | ------------------------------------------------------------ |
| `ELASTICSEARCH_ENDPOINT` | Your ES endpoint (e.g., `https://xyz.es.region.cloud.es.io`) |
| `ELASTICSEARCH_API_KEY`  | Your ES API key                                              |
| `OPENROUTER_API_KEY`     | Your OpenRouter API key                                      |

### Frontend Settings

| Setting     | Default     | Description                    |
| ----------- | ----------- | ------------------------------ |
| Worker URL  | (empty)     | Your Cloudflare Worker URL     |
| ES Index    | `subtitles` | Your Elasticsearch index name  |
| Temperature | `0.7`       | AI creativity (0-1)            |
| Max Results | `50`        | Documents retrieved per search |

## 📁 File Structure

```
elasticsearchweb/
├── index.html              # Main application
├── static/
│   ├── styles.css          # All styling (dark theme)
│   └── app.js              # Frontend logic
├── worker/
│   └── index.js            # Cloudflare Worker
├── wrangler.toml           # Worker configuration
├── deploy.sh               # Deployment script
└── README.md               # This file
```

## 🤖 Timecode Agent Prompt

The app uses your customized timecode agent prompt:

```
You are a documentary-editing research assistant.
Your only inputs are (a) user questions and (b) search results from subtitle files.

QUERY INTERPRETATION:
- Treat single keywords as implicit questions
- Match both literal terms AND related concepts

CITATION FORMAT:
Filename: [filename] | HH:MM:SS – HH:MM:SS:
After the colon, summarize relevant content

OUTPUT HIERARCHY:
Group by topic → sub-group by speaker → sort chronologically
```

## 🎨 Customization

### Change Password

Edit `static/app.js`:

```javascript
const CONFIG = {
  ACCESS_PASSWORD: "your-new-password",
  // ...
};
```

### Change Default Model

Edit `index.html`:

```html
<select id="model-selector">
  <option value="anthropic/claude-3.5-sonnet" selected>
    Claude 3.5 Sonnet
  </option>
  <!-- ... -->
</select>
```

### Add More Models

Edit `worker/index.js`:

```javascript
const models = [
  {
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
  },
  // Add your model here
];
```

## 🛠️ Development

### Local Testing

1. **Worker Development:**

   ```bash
   cd worker
   wrangler dev
   ```

2. **Frontend Development:**

   ```bash
   # Serve index.html locally
   python -m http.server 8000
   # or
   npx serve .
   ```

3. **Update Worker URL in Settings:**
   - Open `http://localhost:8000`
   - Use `http://localhost:8787` as Worker URL (wrangler dev default)

### Building for Production

```bash
# Deploy worker
wrangler deploy

# Commit and push to GitHub
git add .
git commit -m "Update"
git push

# GitHub Pages auto-deploys from main branch
```

## 🔐 Security Notes

- **Password Protection**: Client-side only - not suitable for sensitive data
- **API Keys**: Stored securely in Cloudflare Worker secrets (encrypted)
- **CORS**: Worker handles CORS - your ES keys never touch the browser
- **HTTPS**: Always use HTTPS endpoints for production

For production use with sensitive data, consider:

- Adding server-side authentication to the Worker
- Using Cloudflare Access for additional protection
- Implementing rate limiting

## 🐛 Troubleshooting

### "Please configure Worker URL in settings first"

1. Deploy the Cloudflare Worker
2. Copy the Worker URL (e.g., `https://your-worker.your-subdomain.workers.dev`)
3. Open Settings in the app
4. Paste the URL and save

### Elasticsearch connection errors

1. Verify your ES endpoint URL is correct
2. Check the API key has search permissions
3. Ensure CORS is handled by the Worker (it should be automatic)

### OpenRouter errors

1. Verify your OpenRouter API key
2. Check you have credits in your OpenRouter account
3. Try a different model from the dropdown

## 📄 License

MIT - Feel free to use and modify for your projects.

## 🙏 Credits

- Built with [Cloudflare Workers](https://workers.cloudflare.com)
- AI powered by [OpenRouter](https://openrouter.ai)
- Search powered by [Elasticsearch](https://elastic.co)
