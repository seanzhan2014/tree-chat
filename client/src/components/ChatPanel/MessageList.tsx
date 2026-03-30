import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '../../store/appStore';
import MessageBubble from './MessageBubble';
import { ChevronDown, Sparkles, GitBranch } from 'lucide-react';
import type { Node } from '../../types';

const SUGGESTED_PROMPTS = [
  'Explain a concept simply',
  'Help me write some code',
  'Summarize this topic for me',
  'Give me a step-by-step plan',
  'Compare two approaches',
  'Review and improve my writing',
];

function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-3 my-2">
      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
      <span className="text-xs text-gray-400 flex-shrink-0">{date}</span>
      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: diffDays > 365 ? 'numeric' : undefined });
}

function groupByDate(nodes: Node[]): Array<{ date: string | null; node: Node }> {
  const result: Array<{ date: string | null; node: Node }> = [];
  let lastDate = '';
  for (const node of nodes) {
    const dateKey = new Date(node.created_at).toDateString();
    const showDate = dateKey !== lastDate;
    result.push({ date: showDate ? formatDateLabel(node.created_at) : null, node });
    lastDate = dateKey;
  }
  return result;
}

export default function MessageList() {
  const { currentPath, isStreaming, streamingContent, streamingNodeId, sendMessage, selectedTopicId } = useAppStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const atBottomRef = useRef(true);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
  }, []);

  useEffect(() => {
    if (atBottomRef.current) scrollToBottom();
  }, [currentPath.length, streamingContent]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      atBottomRef.current = dist < 60;
      setShowScrollBtn(dist > 200);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Jump to bottom when switching topics
  useEffect(() => {
    if (currentPath.length > 0) {
      setTimeout(() => scrollToBottom(false), 50);
    }
  }, [selectedTopicId]);

  const grouped = groupByDate(currentPath);
  const isBranch = currentPath.length > 0 && currentPath[0].parent_id !== null;

  // Empty state (no messages in this path)
  if (currentPath.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 mb-4">
              <Sparkles size={28} className="text-white" />
            </div>
            <h2 className="text-xl font-semibold mb-2">How can I help you today?</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {selectedTopicId ? 'Start a new conversation in this chat' : 'Start typing below, or try one of these'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SUGGESTED_PROMPTS.map(prompt => (
              <button
                key={prompt}
                className="text-left px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm text-gray-700 dark:text-gray-300 transition-all"
                onClick={() => sendMessage(prompt)}
              >
                <span className="line-clamp-2">{prompt}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto relative" ref={scrollRef}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Branch indicator */}
        {isBranch && (
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
            <GitBranch size={13} className="flex-shrink-0" />
            <span>This is a branch — continuing from a previous point in the conversation</span>
          </div>
        )}

        {grouped.map(({ date, node }, idx) => {
          const isLast = idx === grouped.length - 1;
          const isStreamingThis = isStreaming && isLast && node.id === streamingNodeId;
          return (
            <div key={node.id}>
              {date && <DateSeparator date={date} />}
              <MessageBubble
                node={node}
                isStreaming={isStreamingThis}
                streamingContent={isStreamingThis ? streamingContent : undefined}
                isLast={isLast}
              />
            </div>
          );
        })}

        {/* Context depth warning */}
        {currentPath.length >= 20 && (
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2">
            <span>⚠️ Long conversation ({currentPath.length} exchanges) — older context may be summarized</span>
          </div>
        )}

        <div ref={bottomRef} className="h-1" />
      </div>

      {/* Scroll-to-bottom FAB */}
      {showScrollBtn && (
        <button
          className="absolute bottom-4 right-4 z-10 p-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full shadow-lg hover:shadow-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
          onClick={() => scrollToBottom()}
        >
          <ChevronDown size={18} className="text-gray-600 dark:text-gray-300" />
        </button>
      )}
    </div>
  );
}
