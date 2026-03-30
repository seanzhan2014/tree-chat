const express = require('express');
const { createAdapter } = require('../llm');

// Rough token estimation (no external deps)
function estimateTokens(text) {
  if (!text) return 0;
  const zh = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const other = text.length - zh;
  return Math.ceil(zh / 1.5 + other / 4);
}

// Generate a fallback node name from user content
function fallbackName(text) {
  const t = text.trim().replace(/\n/g, ' ');
  const zh = (t.match(/[\u4e00-\u9fff]/g) || []).length;
  if (zh / Math.max(t.length, 1) > 0.3) {
    return t.slice(0, 5);
  }
  return t.split(/\s+/).slice(0, 3).join(' ');
}

// SSE helper
function sse(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

const NODE_NAME_INSTRUCTION = `
IMPORTANT: The very first thing you output must be a short label for this exchange, in the format:
<node_name>label</node_name>
Rules:
- English: ≤ 3 words (shorter is better, 1-2 words preferred)
- Chinese: ≤ 5 characters (shorter is better)
- No punctuation, no padding
Then, on a new line, write your actual response.`.trim();

module.exports = (db) => {
  const router = express.Router();

  router.post('/stream', async (req, res) => {
    const { topic_id, parent_node_id, user_content, provider_config } = req.body;

    if (!topic_id || !user_content?.trim() || !provider_config) {
      return res.status(400).json({ error: 'topic_id, user_content, provider_config required' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let aborted = false;
    req.on('close', () => { aborted = true; });

    try {
      // ── 1. Build context ──────────────────────────────────────────────
      const pathNodes = parent_node_id ? db.getPathToNode(parent_node_id) : [];

      // ── 2. Context limit handling ─────────────────────────────────────
      const contextLimit = parseInt(provider_config.contextLimit || 100000);
      let usedNodes = pathNodes;

      let totalTokens = estimateTokens(user_content) + estimateTokens(NODE_NAME_INSTRUCTION);
      for (const n of pathNodes) {
        totalTokens += estimateTokens(n.user_content) + estimateTokens(n.summary || n.assistant_content || '');
      }

      if (totalTokens > contextLimit && pathNodes.length > 2) {
        // Try to summarize the oldest half
        const half = Math.floor(pathNodes.length / 2);
        const toSummarize = pathNodes.slice(0, half);

        try {
          const summaryText = toSummarize
            .map(n => `User: ${n.user_content}\nAssistant: ${n.summary || n.assistant_content || ''}`)
            .join('\n\n---\n\n');

          const summaryAdapter = createAdapter(provider_config);
          let summaryContent = '';
          for await (const tok of summaryAdapter.chatStream(
            [
              { role: 'system', content: 'Summarize the following conversation concisely, preserving key facts and context. Output only the summary.' },
              { role: 'user', content: summaryText },
            ],
            { maxTokens: 600 }
          )) {
            summaryContent += tok;
            if (aborted) break;
          }

          // Store summary on the last node of the summarized group
          const anchorNode = toSummarize[toSummarize.length - 1];
          db.updateNode(anchorNode.id, { summary: summaryContent });

          // Replace summarized nodes with a synthetic placeholder
          const syntheticNode = {
            ...anchorNode,
            user_content: '[Summary of earlier conversation]',
            assistant_content: summaryContent,
          };
          usedNodes = [syntheticNode, ...pathNodes.slice(half)];
        } catch (_) {
          // Fallback: just drop the oldest nodes
          usedNodes = pathNodes.slice(Math.floor(pathNodes.length / 2));
        }
      }

      // ── 3. Compose messages array ─────────────────────────────────────
      const systemPrompt = db.getSetting('system_prompt') || '';
      const systemParts = [];
      if (systemPrompt) systemParts.push(systemPrompt);
      systemParts.push(NODE_NAME_INSTRUCTION);

      const messages = [{ role: 'system', content: systemParts.join('\n\n') }];

      for (const n of usedNodes) {
        messages.push({ role: 'user', content: n.user_content });
        const aContent = n.summary || n.assistant_content;
        if (aContent) messages.push({ role: 'assistant', content: aContent });
      }
      messages.push({ role: 'user', content: user_content.trim() });

      // ── 4. Create pending node ────────────────────────────────────────
      const node = db.createNode({
        topic_id,
        parent_id: parent_node_id || null,
        user_content: user_content.trim(),
        node_name: null,
      });

      sse(res, { type: 'node_created', node_id: node.id });

      // ── 5. Stream LLM response ────────────────────────────────────────
      const adapter = createAdapter(provider_config);
      let fullContent = '';
      let nameBuf = '';
      let nameDone = false;
      let extractedName = null;

      const gen = adapter.chatStream(messages, {
        maxTokens: provider_config.maxTokens || 4096,
      });

      for await (const token of gen) {
        if (aborted) break;

        if (!nameDone) {
          nameBuf += token;

          if (nameBuf.includes('</node_name>')) {
            // Tag fully received
            const match = nameBuf.match(/<node_name>([\s\S]*?)<\/node_name>/);
            extractedName = match ? match[1].trim() : fallbackName(user_content);
            sse(res, { type: 'node_name', name: extractedName });

            // Remainder after the closing tag is real content
            const after = nameBuf.replace(/^[\s\S]*?<\/node_name>\s*\n?/, '');
            if (after) {
              fullContent += after;
              sse(res, { type: 'token', content: after });
            }
            nameDone = true;
            nameBuf = '';
          } else if (
            (nameBuf.length > 150) ||
            (!nameBuf.startsWith('<') && nameBuf.length > 15)
          ) {
            // Model skipped the tag — stream as-is and use fallback name
            extractedName = fallbackName(user_content);
            sse(res, { type: 'node_name', name: extractedName });
            fullContent += nameBuf;
            sse(res, { type: 'token', content: nameBuf });
            nameDone = true;
            nameBuf = '';
          }
        } else {
          fullContent += token;
          sse(res, { type: 'token', content: token });
        }
      }

      // Handle stream that ended while still buffering name
      if (!nameDone && nameBuf) {
        const match = nameBuf.match(/<node_name>([\s\S]*?)<\/node_name>/);
        if (match) {
          extractedName = match[1].trim();
          const after = nameBuf.replace(/^[\s\S]*?<\/node_name>\s*\n?/, '');
          fullContent += after;
        } else {
          extractedName = fallbackName(user_content);
          fullContent += nameBuf;
        }
        sse(res, { type: 'node_name', name: extractedName });
        if (fullContent) sse(res, { type: 'token', content: fullContent });
      }

      // ── 6. Persist & wrap up ──────────────────────────────────────────
      if (!extractedName) extractedName = fallbackName(user_content);
      const tokensUsed = estimateTokens(user_content) + estimateTokens(fullContent);

      db.updateNode(node.id, {
        assistant_content: fullContent,
        node_name: extractedName,
        model: provider_config.model,
        tokens_used: tokensUsed,
      });

      db.updateTopic(topic_id, { last_node_id: node.id });

      sse(res, { type: 'done', tokens: tokensUsed });
      res.end();

    } catch (err) {
      console.error('Chat stream error:', err);
      if (!res.writableEnded) {
        sse(res, { type: 'error', message: err.message });
        res.end();
      }
    }
  });

  // Abort a pending node (if user stops generation mid-stream)
  router.post('/abort/:nodeId', (req, res) => {
    const nodeId = Number(req.params.nodeId);
    const { partial_content, node_name } = req.body;
    if (partial_content !== undefined) {
      db.updateNode(nodeId, {
        assistant_content: partial_content || '[Generation stopped]',
        node_name: node_name || '(stopped)',
      });
      const node = db.getNode(nodeId);
      if (node) db.updateTopic(node.topic_id, { last_node_id: nodeId });
    }
    res.json({ ok: true });
  });

  return router;
};
