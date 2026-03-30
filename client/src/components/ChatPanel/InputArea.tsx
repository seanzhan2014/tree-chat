import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Square, AlertCircle, ChevronDown, Check, Plus } from 'lucide-react';
import { useAppStore } from '../../store/appStore';

const MAX_CHARS_SOFT = 4000;

export default function InputArea() {
  const { isStreaming, sendMessage, stopStreaming, settings, createTopic, selectTopic } = useAppStore();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [modelOpen, setModelOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);

  const activeProvider = settings.providers.find(p => p.id === settings.activeProviderId);
  const providerReady = !!activeProvider?.apiKey;
  const charCount = text.length;
  const charOverSoft = charCount > MAX_CHARS_SOFT;

  // Close model dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) setModelOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keyboard shortcut: Ctrl/Cmd+Shift+N = new chat; Ctrl+, = settings
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        handleNewChat();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        useAppStore.getState().setSettingsOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleNewChat = async () => {
    const topic = await createTopic('New Chat');
    await selectTopic(topic.id);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleSend = useCallback(async () => {
    if (!text.trim() || isStreaming) return;
    const content = text.trim();
    setText('');
    setError(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    try {
      await sendMessage(content);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }, [text, isStreaming, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  };

  const switchProvider = (id: string) => {
    const updated = { ...settings, activeProviderId: id };
    useAppStore.getState().saveSettings(updated);
    setModelOpen(false);
  };

  const canSend = text.trim().length > 0 && !isStreaming && providerReady;

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 pt-3 pb-4 flex-shrink-0">
      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 mb-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button className="flex-shrink-0 hover:opacity-70 text-lg leading-none" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Input box */}
      <div className={`flex flex-col bg-gray-100 dark:bg-gray-800 rounded-2xl border transition-colors
        ${charOverSoft ? 'border-amber-400 dark:border-amber-500' : 'border-gray-200 dark:border-gray-700 focus-within:border-blue-400 dark:focus-within:border-blue-500'}`}>
        <textarea
          ref={textareaRef}
          className="flex-1 bg-transparent resize-none outline-none text-sm leading-relaxed placeholder-gray-400 dark:placeholder-gray-500 px-4 pt-3 pb-2 max-h-[200px] min-h-[52px]"
          placeholder={
            !providerReady
              ? 'Add an API key in Settings to start chatting…'
              : isStreaming
              ? 'Generating…'
              : 'Message Tree Chat…'
          }
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          rows={1}
          autoFocus
        />

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between px-3 pb-2 gap-2">
          <div className="flex items-center gap-1">
            {/* Model selector */}
            <div className="relative" ref={modelRef}>
              <button
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                onClick={() => setModelOpen(v => !v)}
              >
                <span className="max-w-[140px] truncate">
                  {activeProvider ? `${activeProvider.name} · ${activeProvider.model}` : 'No model'}
                </span>
                <ChevronDown size={11} />
              </button>

              {modelOpen && (
                <div className="absolute bottom-full left-0 mb-1 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                  {settings.providers.filter(p => p.apiKey).map(p => (
                    <button
                      key={p.id}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-left transition-colors"
                      onClick={() => switchProvider(p.id)}
                    >
                      <Check size={14} className={p.id === settings.activeProviderId ? 'text-blue-500' : 'opacity-0'} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{p.name}</div>
                        <div className="text-xs text-gray-400 truncate">{p.model}</div>
                      </div>
                    </button>
                  ))}
                  {settings.providers.filter(p => p.apiKey).length === 0 && (
                    <p className="px-3 py-2 text-xs text-gray-400">No providers with API keys</p>
                  )}
                  <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
                    <button
                      className="w-full text-left px-3 py-2 text-xs text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => { setModelOpen(false); useAppStore.getState().setSettingsOpen(true); }}
                    >
                      Manage providers…
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* New chat shortcut */}
            <button
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="New chat (Ctrl+Shift+N)"
              onClick={handleNewChat}
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Character count */}
            {charCount > 500 && (
              <span className={`text-[11px] tabular-nums ${charOverSoft ? 'text-amber-500' : 'text-gray-400'}`}>
                {charCount.toLocaleString()}
              </span>
            )}

            {/* Hint */}
            <span className="text-[11px] text-gray-300 dark:text-gray-600 hidden sm:block">
              Enter to send
            </span>

            {/* Send / Stop */}
            {isStreaming ? (
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs transition-colors font-medium"
                onClick={stopStreaming}
              >
                <Square size={12} />
                Stop
              </button>
            ) : (
              <button
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-colors font-medium
                  ${canSend ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-400 cursor-not-allowed'}`}
                disabled={!canSend}
                onClick={handleSend}
              >
                <Send size={12} />
                Send
              </button>
            )}
          </div>
        </div>
      </div>

      {/* No API key subtle hint (only when no key and no error showing) */}
      {!providerReady && !error && (
        <p className="mt-1.5 text-center text-xs text-gray-400">
          <button className="underline hover:text-gray-600 dark:hover:text-gray-300" onClick={() => useAppStore.getState().setSettingsOpen(true)}>
            Add an API key
          </button>
          {' '}in Settings to start chatting
        </p>
      )}
    </div>
  );
}
