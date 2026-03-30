import { useEffect, useRef, useState } from 'react';
import { useAppStore } from './store/appStore';
import Sidebar from './components/Sidebar';
import ChatPanel from './components/ChatPanel';
import SettingsDialog from './components/Settings';

const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 480;
const DEFAULT_SIDEBAR_WIDTH = 256;

export default function App() {
  const { loadTopics, loadSettings, sidebarCollapsed, setSidebarCollapsed } = useAppStore();
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    Number(localStorage.getItem('tree-chat:sidebarWidth') || DEFAULT_SIDEBAR_WIDTH)
  );
  const widthRef = useRef(sidebarWidth);
  widthRef.current = sidebarWidth;

  useEffect(() => {
    loadSettings().catch(console.error);
    loadTopics().catch(console.error);
  }, []);

  // Ctrl+B — toggle sidebar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setSidebarCollapsed(!sidebarCollapsed);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sidebarCollapsed]);

  // Listen for system theme changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const { settings } = useAppStore.getState();
      if (settings.theme === 'system') {
        document.documentElement.classList.toggle('dark', mq.matches);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = widthRef.current;

    const onMove = (ev: MouseEvent) => {
      const next = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, startWidth + ev.clientX - startX));
      setSidebarWidth(next);
    };

    const onUp = () => {
      localStorage.setItem('tree-chat:sidebarWidth', String(widthRef.current));
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Desktop sidebar — width controlled here */}
      <div
        className="hidden sm:flex flex-col flex-shrink-0 overflow-hidden border-r border-gray-200 dark:border-gray-700 transition-[width] duration-200"
        style={{ width: sidebarCollapsed ? 0 : sidebarWidth }}
      >
        <Sidebar />
      </div>

      {/* Resize handle — only when sidebar is visible */}
      {!sidebarCollapsed && (
        <div
          className="hidden sm:flex w-1 flex-shrink-0 cursor-col-resize relative group"
          onMouseDown={handleResizeMouseDown}
        >
          <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-blue-400 group-active:bg-blue-500 transition-colors" />
        </div>
      )}

      <ChatPanel />
      <SettingsDialog />
    </div>
  );
}
