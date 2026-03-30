import { useAppStore } from '../../store/appStore';
import MessageList from './MessageList';
import InputArea from './InputArea';
import { Menu, GitBranch, AlertTriangle, PanelLeftOpen } from 'lucide-react';

export default function ChatPanel() {
  const { selectedTopicId, topics, currentPath, setSidebarOpen, setSidebarCollapsed, sidebarCollapsed, settings } = useAppStore();
  const topic = topics.find(t => t.id === selectedTopicId);
  const activeProvider = settings.providers.find(p => p.id === settings.activeProviderId);

  const breadcrumbs = currentPath.filter(n => n.node_name).map(n => n.node_name as string);
  const depth = currentPath.length;
  const contextPct = activeProvider
    ? Math.round((depth * 500 / activeProvider.contextLimit) * 100)
    : 0;

  return (
    <main className="flex flex-col flex-1 min-w-0 h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 min-h-[48px] flex-shrink-0">
        {/* Mobile sidebar toggle */}
        <button
          className="sm:hidden flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu size={18} />
        </button>
        {/* Desktop expand button — shown only when sidebar is collapsed */}
        {sidebarCollapsed && (
          <button
            className="hidden sm:flex flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
            title="Expand sidebar"
            onClick={() => setSidebarCollapsed(false)}
          >
            <PanelLeftOpen size={18} />
          </button>
        )}

        <div className="flex-1 min-w-0">
          {topic ? (
            <>
              <h1 className="text-sm font-semibold truncate leading-tight">{topic.title}</h1>
              {breadcrumbs.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-gray-400 truncate leading-tight">
                  <GitBranch size={10} className="flex-shrink-0" />
                  <span className="truncate">{breadcrumbs.join(' › ')}</span>
                </div>
              )}
            </>
          ) : (
            <h1 className="text-sm font-semibold text-gray-400">Tree Chat</h1>
          )}
        </div>

        {/* Context usage */}
        {depth > 0 && (
          <div className="flex-shrink-0 flex items-center gap-1.5">
            {contextPct >= 80 && (
              <AlertTriangle size={13} className="text-amber-500" />
            )}
            <div className="text-xs text-gray-400 flex items-center gap-1">
              <div className="w-16 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${contextPct >= 80 ? 'bg-amber-500' : 'bg-blue-400'}`}
                  style={{ width: `${Math.min(contextPct, 100)}%` }}
                />
              </div>
              <span className="text-[11px]">{depth}n</span>
            </div>
          </div>
        )}
      </div>

      <MessageList />
      <InputArea />
    </main>
  );
}
