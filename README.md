# Tree Chat

A self-hosted AI chat application with **tree-structured conversation history** — enabling branching conversations, deep context control, and multi-provider support. Deployable locally or on any cloud server via Docker.

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
- Inline topic rename — double-click any topic title to edit it
- Branch indicator — an amber banner appears when you are viewing a sub-branch rather than the main thread

### Topics & Sessions
- **Auto-create topic** — if no topic is selected when you send your first message, a topic is created automatically from the first 6 words
- **Auto-rename topic** — after the first AI response, the topic is renamed to match the generated node name
- **Session restore** — the last selected topic is remembered and restored on page reload

### Context Management
- Context sent to the AI = only the path from root → current node
- Configurable context limit per provider (tokens)
- Auto-summarizes oldest nodes when the context window is nearly full
- Visual context usage bar in the header (turns amber at ≥80%)
- Context depth warning in the message list at ≥20 exchanges

### Multi-Provider Support
| Provider | Notes |
|---|---|
| OpenAI | GPT-4o, o1, o3, custom models |
| Anthropic | Claude 3.5 / 4.x series |
| 通义千问 (Qianwen) | DashScope compatible mode |
| Custom | Any OpenAI-compatible API (e.g. Fireworks AI, Together AI, local Ollama) |

- Test connection & fetch available models directly from the Settings panel
- Quick-switch provider from the input toolbar without opening Settings

### UI & Usability
- **Resizable sidebar** — drag the divider to adjust width (180–480px), persisted across sessions
- **Collapsible sidebar** — toggle with the `⊡` button in the sidebar header or `Ctrl+B`
- **Draggable dialogs** — Settings and confirmation dialogs can be dragged anywhere on screen
- **Topic search** — a search bar appears in the sidebar when you have more than 3 topics
- **Character counter** — shown in the input toolbar above 500 characters; the input border turns amber above 4,000
- **Stop generation** — a Stop button replaces Send while the AI is responding; also callable via the abort API
- **Keyboard shortcuts**:
  | Shortcut | Action |
  |---|---|
  | `Enter` | Send message |
  | `Shift+Enter` | New line |
  | `Ctrl+Shift+N` | New chat |
  | `Ctrl+,` | Open Settings |
  | `Ctrl+B` | Toggle sidebar |
  | `Escape` | Close dialog |
- Suggested prompts on the welcome screen
- Message copy, inline edit, and regenerate buttons
- Date separators (Today / Yesterday / date) between messages
- Scroll-to-bottom floating button
- Light / Dark / System theme
- Mobile-responsive with a slide-in drawer sidebar

### Data
- SQLite database, stored at `server/data/treechat.db`
- Export all chats and settings to a JSON file
- Import from a previously exported JSON file (replaces all existing data)

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

Open `http://localhost:5173`, then go to **Settings → Providers** and add an API key.

### Production Build

```bash
npm run build   # builds client into client/dist/
npm start       # serves API + static files on port 3001
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

The app will be available at `http://localhost:3001`. Data is persisted in a `./data` volume on the host.

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
3. Open port 3001 in your firewall / security group (or put it behind Nginx)

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

The LLM response starts with a `<node_name>label</node_name>` tag. The server parses this mid-stream and emits it as a separate SSE event, so the node name appears in the sidebar before the full response finishes. If the tag is not found within the first 150 characters of the response, a fallback name is generated from the first few words of the user message.

### Streaming Architecture

```
Client  →  POST /api/chat/stream
Server  →  Builds context path from DB
        →  Calls LLM streaming API
        →  Emits SSE events: node_created | node_name | token | done | error
Client  →  Updates UI optimistically on each event
```

### LLM Adapters

- `OpenAIAdapter` — handles OpenAI, Fireworks AI, Together AI, Ollama, and any OpenAI-compatible endpoint. Includes smart URL construction to prevent double `/v1` when the base URL already contains it.
- `AnthropicAdapter` — handles the separate `system` field required by Anthropic's API, and parses `content_block_delta` SSE events.
- `QianwenAdapter` — extends `OpenAIAdapter` with DashScope's base URL.

---

## Settings Reference

| Setting | Description |
|---|---|
| API Key | Provider API key (stored in local SQLite, never sent to third parties) |
| Base URL | Override the API endpoint (useful for proxies or local models) |
| Model | Model ID, or click "Fetch" to list all models available on the endpoint |
| Context limit | Max tokens to send per request (older nodes are summarized if exceeded) |
| Max output tokens | Maximum tokens the AI may generate per response |
| System Prompt | Optional instructions prepended to every conversation |
| Node name language | Auto / English / Chinese — language used for generated node names |
| Max English words | Max word count for English node names (default: 3) |
| Max Chinese chars | Max character count for Chinese node names (default: 5) |
| Theme | Light / Dark / System |

---

## License

MIT
