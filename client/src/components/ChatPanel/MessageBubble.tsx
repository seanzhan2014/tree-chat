import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Copy, Check, RotateCcw, User, Bot, Pencil, X, Send } from 'lucide-react';
import 'highlight.js/styles/github-dark.css';
import type { Node } from '../../types';
import { useAppStore } from '../../store/appStore';
import * as api from '../../services/api';

interface Props {
  node: Node;
  isStreaming?: boolean;
  streamingContent?: string;
  isLast?: boolean;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
      title="Copy"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
    >
      {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
    </button>
  );
}

function CodeBlock({ children, className }: { children?: React.ReactNode; className?: string }) {
  const code = String(children).replace(/\n$/, '');
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group my-3 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between bg-gray-200 dark:bg-gray-700 px-3 py-1">
        <span className="text-xs text-gray-500 dark:text-gray-400">{className?.replace('language-', '') || 'code'}</span>
        <button
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        >
          {copied ? <><Check size={11} className="text-green-500" /> Copied</> : <><Copy size={11} /> Copy</>}
        </button>
      </div>
      <pre className={`${className} !m-0 !rounded-none`}><code className={className}>{children}</code></pre>
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      className="prose dark:prose-invert prose-sm max-w-none"
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        pre: ({ children }) => <>{children}</>,
        code({ className, children }) {
          if (className?.includes('language-')) return <CodeBlock className={className}>{children}</CodeBlock>;
          return <code className={className}>{children}</code>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Editable user message — on submit creates a new branch from parent
function UserMessage({ node, isLast }: { node: Node; isLast: boolean }) {
  const { selectedTopicId, currentPath, isStreaming: globalStreaming } = useAppStore();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(node.user_content);
  const [showActions, setShowActions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [editing]);

  const cancelEdit = () => { setEditText(node.user_content); setEditing(false); };

  const submitEdit = async () => {
    const content = editText.trim();
    if (!content || content === node.user_content) { cancelEdit(); return; }

    setEditing(false);
    // Delete this node (and its subtree), then send edited message from parent
    const parentId = node.parent_id;
    await api.deleteNode(node.id);

    // Rebuild path without this node and beyond
    const newPath = currentPath.filter(n => n.id !== node.id);
    useAppStore.setState({ currentPath: newPath, selectedNodeId: parentId });

    if (selectedTopicId && useAppStore.getState().expandedTopicIds.has(selectedTopicId)) {
      const nodes = await api.getTopicTree(selectedTopicId);
      useAppStore.setState(s => ({ nodesByTopic: { ...s.nodesByTopic, [selectedTopicId]: nodes } }));
    }

    await useAppStore.getState().sendMessage(content);
  };

  if (editing) {
    return (
      <div className="flex gap-3 justify-end">
        <div className="max-w-[85%] flex flex-col gap-2">
          <textarea
            ref={textareaRef}
            className="w-full bg-blue-50 dark:bg-blue-900/30 border border-blue-400 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed resize-none outline-none"
            value={editText}
            onChange={e => {
              setEditText(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 300) + 'px';
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(); }
              if (e.key === 'Escape') cancelEdit();
            }}
          />
          <div className="flex justify-end gap-2">
            <button className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" onClick={cancelEdit}>
              <X size={12} /> Cancel
            </button>
            <button className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors" onClick={submitEdit}>
              <Send size={12} /> Send edited
            </button>
          </div>
        </div>
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mt-0.5">
          <User size={14} className="text-blue-600 dark:text-blue-400" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex gap-3 justify-end group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="max-w-[80%] flex flex-col items-end gap-1">
        <div className="relative">
          <div className="bg-blue-500 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
            {node.user_content}
          </div>
          {/* Edit button on hover */}
          {!globalStreaming && (showActions || isLast) && (
            <button
              className="absolute -left-8 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shadow-sm transition-all opacity-0 group-hover:opacity-100"
              title="Edit message"
              onClick={() => setEditing(true)}
            >
              <Pencil size={12} />
            </button>
          )}
        </div>
        <span className="text-[11px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity px-1">
          {formatTime(node.created_at)}
        </span>
      </div>
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mt-0.5">
        <User size={14} className="text-blue-600 dark:text-blue-400" />
      </div>
    </div>
  );
}

export default function MessageBubble({ node, isStreaming, streamingContent, isLast }: Props) {
  const { regenerateMessage, isStreaming: globalStreaming } = useAppStore();
  const assistantContent = isStreaming ? (streamingContent || '') : (node.assistant_content || '');
  const [showActions, setShowActions] = useState(false);

  return (
    <div className="space-y-4">
      <UserMessage node={node} isLast={!!isLast} />

      {/* Assistant message */}
      {(assistantContent || isStreaming) && (
        <div
          className="flex gap-3 group"
          onMouseEnter={() => setShowActions(true)}
          onMouseLeave={() => setShowActions(false)}
        >
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center mt-0.5">
            <Bot size={14} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed">
              {assistantContent ? (
                <MarkdownContent content={assistantContent} />
              ) : (
                <span className="inline-flex gap-1 items-center">
                  {[0, 150, 300].map(d => (
                    <span key={d} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </span>
              )}
            </div>

            {/* Meta + actions */}
            <div className="mt-1.5 flex items-center gap-1 flex-wrap">
              <span className="text-[11px] text-gray-400 px-1">
                {node.model && <span>{node.model}</span>}
                {node.tokens_used && <span> · ~{node.tokens_used} tokens</span>}
                {!isStreaming && <span> · {formatTime(node.created_at)}</span>}
              </span>
              {node.node_name && (
                <span className="text-[11px] bg-gray-100 dark:bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded-md border border-gray-200 dark:border-gray-700">
                  {node.node_name}
                </span>
              )}
              {!isStreaming && (
                <div className={`flex items-center gap-0.5 ml-1 transition-opacity ${showActions || isLast ? 'opacity-100' : 'opacity-0'}`}>
                  <CopyBtn text={assistantContent} />
                  {isLast && !globalStreaming && (
                    <button
                      className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                      title="Regenerate response"
                      onClick={regenerateMessage}
                    >
                      <RotateCcw size={13} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
