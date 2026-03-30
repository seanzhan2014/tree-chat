import { useState, useMemo } from 'react';
import { Plus, Settings, TreePine, Search, X, PanelLeftClose } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import TopicItem from './TopicItem';

export default function Sidebar() {
  const { topics, createTopic, selectTopic, setSettingsOpen, sidebarOpen, setSidebarOpen, setSidebarCollapsed } = useAppStore();
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  const filteredTopics = useMemo(() => {
    if (!search.trim()) return topics;
    const q = search.toLowerCase();
    return topics.filter(t => t.title.toLowerCase().includes(q));
  }, [topics, search]);

  const handleCreate = async () => {
    const title = newTitle.trim() || 'New Chat';
    const topic = await createTopic(title);
    setNewTitle('');
    setCreating(false);
    await selectTopic(topic.id);
    setSidebarOpen(false);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <TreePine size={18} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        <span className="font-semibold text-sm flex-1">Tree Chat</span>
        <button
          className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
          title="Settings"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings size={15} />
        </button>
        {/* Desktop collapse */}
        <button
          className="hidden sm:flex p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
          title="Collapse sidebar"
          onClick={() => setSidebarCollapsed(true)}
        >
          <PanelLeftClose size={15} />
        </button>
        {/* Mobile close */}
        <button
          className="sm:hidden p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
          onClick={() => setSidebarOpen(false)}
        >
          <X size={15} />
        </button>
      </div>

      {/* New chat + search */}
      <div className="px-2 pt-2 pb-1 space-y-1.5 flex-shrink-0">
        {creating ? (
          <div className="flex gap-1">
            <input
              autoFocus
              className="flex-1 text-sm px-2.5 py-1.5 rounded-xl border border-blue-400 bg-white dark:bg-gray-800 outline-none"
              placeholder="Chat title…"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') { setNewTitle(''); setCreating(false); }
              }}
              onBlur={() => { if (!newTitle.trim()) setCreating(false); }}
            />
            <button className="px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors" onClick={handleCreate}>Add</button>
          </div>
        ) : (
          <button
            className="w-full flex items-center gap-2 px-2.5 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors font-medium"
            onClick={() => setCreating(true)}
          >
            <Plus size={15} />
            New Chat
          </button>
        )}

        {/* Search */}
        {topics.length > 3 && (
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full text-sm pl-7 pr-3 py-1.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 outline-none focus:border-blue-400 transition-colors"
              placeholder="Search chats…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => setSearch('')}>
                <X size={13} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Topic list */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {filteredTopics.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-12 px-4 text-center gap-3">
            {search ? (
              <p className="text-xs text-gray-400">No chats match "{search}"</p>
            ) : (
              <>
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <TreePine size={20} className="text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No chats yet</p>
                  <p className="text-xs text-gray-400 mt-0.5">Click "New Chat" or just start typing</p>
                </div>
              </>
            )}
          </div>
        ) : (
          filteredTopics.map(topic => (
            <TopicItem key={topic.id} topic={topic} onSelect={() => setSidebarOpen(false)} />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
        <p className="text-xs text-gray-400 text-center">
          {topics.length} {topics.length === 1 ? 'chat' : 'chats'}
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar content — App.tsx controls visibility/width */}
      <div className="hidden sm:flex flex-col h-full w-full">
        {sidebarContent}
      </div>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="sm:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-50 w-72 h-full shadow-xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
