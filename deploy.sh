#!/bin/bash
# Documentary Research Assistant - Deployment Script
# This script deploys the Cloudflare Worker

set -e

# Parse arguments
UPDATE_SECRETS=false
if [ "$1" == "--setup" ] || [ "$1" == "--update-secrets" ]; then
    UPDATE_SECRETS=true
fi

echo "🎬 Documentary Research Assistant Deployment"
echo "============================================="

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ required. You have: $(node --version)"
    echo ""
    echo "Please install Node.js 18 or higher:"
    echo "  - Using nvm: nvm install 20 && nvm use 20"
    echo "  - Using Homebrew: brew install node@20"
    echo "  - Download from: https://nodejs.org/"
    exit 1
fi

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "📦 Installing wrangler..."
    npm install -g wrangler
fi

# Check if user is logged in
if ! wrangler whoami &> /dev/null; then
    echo "🔐 Please login to Cloudflare..."
    wrangler login
fi

# Get account info
echo ""
echo "📋 Account Information:"
wrangler whoami

echo ""
echo "🔧 Configuration:"
echo "  Worker name: documentary-research-assistant"
echo "  Entry point: worker/index.js"

# Only prompt for secrets if --setup flag is passed or if this is first deploy
if [ "$UPDATE_SECRETS" = true ]; then
    echo ""
    echo "⚙️  Setting up secrets..."
    
    # Prompt for secrets
    read -p "Enter your Elasticsearch endpoint URL: " ES_ENDPOINT
    read -p "Enter your Elasticsearch API key: " ES_API_KEY
    read -p "Enter your OpenRouter API key: " OR_API_KEY
    
    # Store secrets
    echo "  Storing ELASTICSEARCH_ENDPOINT..."
    echo "$ES_ENDPOINT" | wrangler secret put ELASTICSEARCH_ENDPOINT
    
    echo "  Storing ELASTICSEARCH_API_KEY..."
    echo "$ES_API_KEY" | wrangler secret put ELASTICSEARCH_API_KEY
    
    echo "  Storing OPENROUTER_API_KEY..."
    echo "$OR_API_KEY" | wrangler secret put OPENROUTER_API_KEY
else
    echo ""
    echo "ℹ️  Using existing secrets (pass --setup to update them)"
fi

echo ""
echo "🚀 Deploying worker..."
wrangler deploy

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Copy the worker URL above"
echo "  2. Open index.html in your browser"
echo "  3. Click Settings (⚙️) and paste the worker URL"
echo "  4. Set your Elasticsearch index name"
echo "  5. Start chatting!"
echo ""

# Optional: Deploy to GitHub Pages
read -p "Would you like to deploy to GitHub Pages now? (y/n): " DEPLOY_GH

if [[ $DEPLOY_GH == "y" || $DEPLOY_GH == "Y" ]]; then
    echo ""
    echo "📦 Preparing GitHub Pages deployment..."
    
    # Check if git is initialized
    if [ ! -d ".git" ]; then
        echo "  Initializing git repository..."
        git init
        git branch -M main
    fi
    
    # Add all files
    git add .
    git commit -m "Initial commit: Documentary Research Assistant" || echo "Nothing to commit"
    
    echo ""
    echo "🌐 To deploy to GitHub Pages:"
    echo "  1. Create a new repository on GitHub"
    echo "  2. Run: git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git"
    echo "  3. Run: git push -u origin main"
    echo "  4. Go to repository Settings > Pages"
    echo "  5. Select 'Deploy from a branch' and choose 'main'"
    echo ""
fi

echo "🎉 All done! Your Documentary Research Assistant is ready."
