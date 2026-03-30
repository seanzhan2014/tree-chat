# Tree Chat

A self-hosted AI chat application with **tree-structured conversation history** — enabling branching conversations, deep context control, and multi-provider support. Deployable locally or on any cloud server via Docker.

![Tree Chat Screenshot](https://raw.githubusercontent.com/seanzhan2014/tree-chat/main/docs/screenshot.png)

## Why Tree Chat?

Traditional chat tools force you into a single linear thread. Tree Chat stores every exchange as a node in a tree, so you can:

- **Branch from any point** — continue a conversation from a previous message without losing the current thread
- **Precise context control** — the AI only sees the path from root to current node, not the entire history
- **Explore alternatives** — edit a message to create a new branch, compare different AI responses side by side

---

## Features

### Conversation Tree
- Each chat topic contains a tree of message exchanges (nodes)
- Collapse/expand the tree per topic in the sidebar
- Click any node to resume from that exact point
- Delete a node to remove it and all its descendants (with confirmation)
- Auto-generated node names (≤3 English words / ≤5 Chinese characters) appear as breadcrumbs in the header

### Context Management
- Context sent to the AI = only the path from root → current node
- Configurable context limit per provider (tokens)
- Auto-summarizes oldest nodes when the context window is nearly full
- Visual context usage bar in the header (turns amber at 80%)

### Multi-Provider Support
| Provider | Notes |
|---|---|
| OpenAI | GPT-4o, o1, o3, custom models |
| Anthropic | Claude 3.5/4.x series |
| 通义千问 (Qianwen) | DashScope compatible mode |
| Custom | Any OpenAI-compatible API (e.g. Fireworks AI, Together AI, local Ollama) |

- Test connection & fetch available models directly from the Settings panel
- Quick-switch provider from the input toolbar without opening Settings

### UI & Usability
- **Resizable sidebar** — drag the divider to adjust width (180–480px), persisted across sessions
- **Collapsible sidebar** — toggle with the panel button or `Ctrl+B`
- **Draggable dialogs** — Settings and confirmation dialogs can be moved anywhere on screen
- **Keyboard shortcuts**:
  - `Enter` — send message
  - `Shift+Enter` — newline
  - `Ctrl+Shift+N` — new chat
  - `Ctrl+,` — open Settings
  - `Ctrl+B` — toggle sidebar
  - `Escape` — close dialog
- Suggested prompts on the welcome screen
- Message copy, edit, and regenerate buttons
- Date separators and scroll-to-bottom button
- Light / Dark / System theme
- Mobile-responsive with a slide-in drawer sidebar

### Data
- SQLite database, stored locally at `server/data/treechat.db`
- Export all data to JSON
- Import from a previously exported JSON file (replaces all data)

---

## Quick Start (Local)

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
git clone https://github.com/seanzhan2014/tree-chat.git
cd tree-chat
npm run install:all
```

### Development

```bash
npm run dev
```

This starts:
- **Backend** at `http://localhost:3001`
- **Frontend** at `http://localhost:5173` (Vite dev server with HMR)

Open `http://localhost:5173` in your browser, then go to **Settings → Providers** and add an API key.

### Production Build

```bash
npm run build   # builds client into client/dist/
npm start       # serves both API and static files from port 3001
```

Open `http://localhost:3001`.

---

## Docker Deployment

### Using Docker Compose (recommended)

```bash
git clone https://github.com/seanzhan2014/tree-chat.git
cd tree-chat
docker-compose up -d
```

The app will be available at `http://localhost:3001`.

Data is persisted in a `./data` volume on the host.

### Manual Docker

```bash
docker build -t tree-chat .
docker run -d \
  -p 3001:3001 \
  -v $(pwd)/data:/app/data \
  --name tree-chat \
  tree-chat
```

### Cloud Deployment (Alibaba Cloud ECS / any VPS)

1. SSH into your server and install Docker + Docker Compose
2. Clone the repo and run `docker-compose up -d`
3. Configure your security group / firewall to allow port 3001 (or put it behind Nginx)

Optional Nginx reverse proxy:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # Required for SSE streaming
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}
```

---

## Project Structure

```
tree-chat/
├── server/
│   ├── index.js              # Express app entry point
│   ├── db/
│   │   └── SQLiteAdapter.js  # Database adapter (materialized path tree)
│   ├── llm/
│   │   ├── BaseAdapter.js    # Base LLM adapter interface
│   │   ├── OpenAIAdapter.js  # OpenAI + compatible APIs
│   │   ├── AnthropicAdapter.js
│   │   └── QianwenAdapter.js # Extends OpenAI adapter
│   └── routes/
│       ├── chat.js           # SSE streaming + node name generation
│       ├── topics.js
│       ├── nodes.js
│       ├── settings.js
│       └── providers.js      # Test connection + fetch models
├── client/
│   └── src/
│       ├── components/
│       │   ├── ChatPanel/    # MessageList, MessageBubble, InputArea
│       │   ├── Sidebar/      # TopicItem, NodeTree
│       │   ├── Settings/     # ProviderForm, tabs
│       │   └── common/       # ConfirmDialog
│       ├── store/
│       │   └── appStore.ts   # Zustand global state
│       └── services/
│           └── api.ts        # REST + SSE client
├── Dockerfile
├── docker-compose.yml
└── package.json              # Root scripts (dev, build, start)
```

---

## Technical Design

### Tree Storage: Materialized Path

Each node stores its ancestor path as a string (e.g. `/1/4/9/`), enabling:
- Subtree queries with a single `LIKE` (no recursive CTEs)
- Root-to-node path reconstruction without joins
- Compatible with SQLite, PostgreSQL, and MySQL

### Node Name Generation

The LLM response starts with a `<node_name>label</node_name>` tag. The server parses this mid-stream and emits it as a separate SSE event, so the node name appears in the sidebar before the full response finishes.

### Streaming Architecture

```
Client  →  POST /api/chat/stream
Server  →  Builds context path from DB
        →  Calls LLM streaming API
        →  Emits SSE events: node_created | node_name | token | done | error
Client  →  Updates UI optimistically on each event
```

### LLM Adapters

- `OpenAIAdapter` — handles OpenAI, Fireworks AI, Together AI, Ollama, and any OpenAI-compatible endpoint (smart URL construction to avoid double `/v1`)
- `AnthropicAdapter` — handles the separate `system` field required by Anthropic's API
- `QianwenAdapter` — extends `OpenAIAdapter` with DashScope's base URL

---

## Settings Reference

| Setting | Description |
|---|---|
| API Key | Provider API key (stored in local SQLite, never sent to third parties) |
| Base URL | Override the API endpoint (useful for proxies or local models) |
| Model | Model ID, or use "Fetch" to list all available models |
| Context limit | Max tokens to send to the AI (older nodes are summarized if exceeded) |
| Max output tokens | Maximum tokens the AI may generate per response |
| System Prompt | Optional instructions prepended to every conversation |
| Node name language | Auto / English / Chinese — controls the language of generated node names |
| Theme | Light / Dark / System |

---

## License

MIT
