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

---

---

# Tree Chat（中文说明）

一款支持**树状对话历史**的自托管 AI 聊天工具——可分支对话、精确控制上下文、支持多个 AI 提供商。可本地运行，也可通过 Docker 部署到任意云服务器。

## 为什么选择 Tree Chat？

传统聊天工具只能线性追加消息。Tree Chat 将每次对话记录为树上的一个节点，因此你可以：

- **从任意节点分支** — 从历史某条消息继续对话，原线程完整保留
- **精确控制上下文** — AI 只看到从根节点到当前节点的路径，而非全部历史
- **探索多种方向** — 编辑任意一条消息即可创建新分支，横向比较不同的 AI 回答

---

## 功能特性

### 对话树
- 每个话题（Topic）包含一棵消息交换树，每个节点存储一组用户+AI 对话
- 侧边栏可折叠/展开每个话题的树形结构
- 点击任意节点即可从该位置继续对话
- 删除节点会同时删除其所有子节点（有二次确认）
- 自动生成节点名称（英文 ≤3 词 / 中文 ≤5 字），显示为顶栏面包屑导航
- 双击话题标题可内联重命名
- 从非根节点继续时，消息列表顶部显示琥珀色**分支提示横幅**

### 话题与会话
- **自动创建话题** — 未选中话题时发送消息，自动从前 6 个词生成话题名
- **自动重命名话题** — 第一条 AI 回复完成后，话题名自动更新为节点名
- **会话恢复** — 刷新页面后自动恢复上次选中的话题

### 上下文管理
- 发送给 AI 的上下文 = 仅根节点到当前节点的路径
- 每个提供商可单独配置上下文 Token 上限
- 超出限制时自动总结最旧的节点
- 顶栏显示上下文使用进度条（≥80% 时变琥珀色）
- 对话深度 ≥20 轮时在消息列表底部显示警告

### 多提供商支持
| 提供商 | 说明 |
|---|---|
| OpenAI | GPT-4o、o1、o3 及自定义模型 |
| Anthropic | Claude 3.5 / 4.x 系列 |
| 通义千问 | DashScope 兼容模式 |
| 自定义 | 任何 OpenAI 兼容接口（如 Fireworks AI、Together AI、本地 Ollama） |

- 在设置面板中直接测试连接、拉取可用模型列表
- 从输入框工具栏快速切换提供商，无需打开设置

### 界面与易用性
- **侧边栏宽度可拖拽** — 拖动分割线调整宽度（180–480px），跨会话保留
- **侧边栏可折叠** — 点击 `⊡` 按钮或按 `Ctrl+B` 收起/展开
- **对话框可拖动** — 设置窗口和确认弹框均可在屏幕上自由拖动
- **话题搜索** — 话题数量超过 3 个时，侧边栏自动显示搜索框
- **字符计数** — 输入超过 500 字符时显示计数；超过 4000 字符时输入框边框变为琥珀色
- **停止生成** — AI 响应中途可点击 Stop 按钮中断
- **键盘快捷键**：
  | 快捷键 | 功能 |
  |---|---|
  | `Enter` | 发送消息 |
  | `Shift+Enter` | 换行 |
  | `Ctrl+Shift+N` | 新建聊天 |
  | `Ctrl+,` | 打开设置 |
  | `Ctrl+B` | 折叠/展开侧边栏 |
  | `Escape` | 关闭弹窗 |
- 欢迎页提供 6 个快捷提示按钮
- 消息支持复制、内联编辑、重新生成
- 消息列表显示日期分隔线（今天 / 昨天 / 具体日期）
- 滚动到底部悬浮按钮
- 亮色 / 暗色 / 跟随系统 主题
- 移动端响应式布局，侧边栏以抽屉形式滑入

### 数据管理
- 数据存储在本地 SQLite 文件 `server/data/treechat.db`
- 支持将全部聊天和设置导出为 JSON 文件
- 支持从导出文件导入（会替换全部现有数据）

---

## 快速开始（本地运行）

### 环境要求
- Node.js 18+
- npm

### 安装

```bash
git clone https://github.com/seanzhan2014/tree-chat.git
cd tree-chat
npm run install:all
```

### 开发模式

```bash
npm run dev
```

启动后：
- **后端** 运行在 `http://localhost:3001`
- **前端** 运行在 `http://localhost:5173`（Vite 热更新）

打开 `http://localhost:5173`，进入 **设置 → 提供商** 添加 API Key 即可开始使用。

### 生产构建

```bash
npm run build   # 将前端构建到 client/dist/
npm start       # 在 3001 端口同时提供 API 和静态文件
```

打开 `http://localhost:3001`。

---

## Docker 部署

### 使用 Docker Compose（推荐）

```bash
git clone https://github.com/seanzhan2014/tree-chat.git
cd tree-chat
docker-compose up -d
```

访问 `http://localhost:3001`。数据持久化在宿主机的 `./data` 目录。

### 手动 Docker

```bash
docker build -t tree-chat .
docker run -d \
  -p 3001:3001 \
  -v $(pwd)/data:/app/data \
  --name tree-chat \
  tree-chat
```

### 云服务器部署（阿里云 ECS / 任意 VPS）

1. SSH 登录服务器，安装 Docker 和 Docker Compose
2. 克隆仓库并执行 `docker-compose up -d`
3. 在安全组 / 防火墙开放 3001 端口（或配置 Nginx 反向代理）

可选 Nginx 反向代理配置：

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

        # SSE 流式响应必须关闭缓冲
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}
```

---

## 项目结构

```
tree-chat/
├── server/
│   ├── index.js              # Express 入口
│   ├── db/
│   │   └── SQLiteAdapter.js  # 数据库适配器（物化路径树）
│   ├── llm/
│   │   ├── BaseAdapter.js    # LLM 适配器基类
│   │   ├── OpenAIAdapter.js  # OpenAI 及兼容接口
│   │   ├── AnthropicAdapter.js
│   │   └── QianwenAdapter.js # 继承 OpenAIAdapter
│   └── routes/
│       ├── chat.js           # SSE 流式传输 + 节点名生成
│       ├── topics.js
│       ├── nodes.js
│       ├── settings.js
│       └── providers.js      # 测试连接 + 拉取模型列表
├── client/
│   └── src/
│       ├── components/
│       │   ├── ChatPanel/    # MessageList、MessageBubble、InputArea
│       │   ├── Sidebar/      # TopicItem、NodeTree
│       │   ├── Settings/     # ProviderForm、选项卡
│       │   └── common/       # ConfirmDialog
│       ├── store/
│       │   └── appStore.ts   # Zustand 全局状态
│       └── services/
│           └── api.ts        # REST + SSE 客户端
├── Dockerfile
├── docker-compose.yml
└── package.json              # 根脚本（dev、build、start）
```

---

## 技术设计

### 树结构存储：物化路径

每个节点存储其祖先路径字符串（如 `/1/4/9/`），实现：
- 用单条 `LIKE` 查询完成子树操作（无需递归 CTE）
- 无需 JOIN 即可还原根到当前节点的完整路径
- 兼容 SQLite、PostgreSQL、MySQL

### 节点名称生成

LLM 响应以 `<node_name>标签</node_name>` 开头，服务端在流式传输过程中解析该标签，并作为独立 SSE 事件发送，使节点名在完整回复生成前就显示在侧边栏。若前 150 个字符内未找到标签，则从用户消息的前几个词自动生成兜底名称。

### 流式传输架构

```
客户端  →  POST /api/chat/stream
服务端  →  从数据库构建上下文路径
        →  调用 LLM 流式 API
        →  发送 SSE 事件：node_created | node_name | token | done | error
客户端  →  每个事件触发乐观 UI 更新
```

### LLM 适配器

- `OpenAIAdapter` — 处理 OpenAI、Fireworks AI、Together AI、Ollama 及任何兼容接口，内置智能 URL 构造防止 `/v1` 重复
- `AnthropicAdapter` — 处理 Anthropic API 要求的独立 `system` 字段，解析 `content_block_delta` SSE 事件
- `QianwenAdapter` — 继承 `OpenAIAdapter`，预设 DashScope 接入地址

---

## 设置项说明

| 设置项 | 说明 |
|---|---|
| API Key | 提供商的 API 密钥（存储在本地 SQLite，不会发送给第三方） |
| Base URL | 覆盖 API 端点（适用于代理或本地模型） |
| Model | 模型 ID，或点击"Fetch"从端点拉取可用模型列表 |
| Context limit | 每次请求发送的最大 Token 数（超出时自动总结旧节点） |
| Max output tokens | AI 每次响应最多生成的 Token 数 |
| System Prompt | 可选的系统提示词，每次对话都会附加 |
| Node name language | 自动 / 英文 / 中文 — 节点名称使用的语言 |
| Max English words | 英文节点名最大词数（默认 3） |
| Max Chinese chars | 中文节点名最大字数（默认 5） |
| Theme | 亮色 / 暗色 / 跟随系统 |

---

## 开源协议

MIT
