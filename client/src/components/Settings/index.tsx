import { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Download, Upload, Save, Loader } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import type { AppSettings, ProviderConfig } from '../../types';
import { DEFAULT_PROVIDERS } from '../../types';
import ProviderForm from './ProviderForm';
import { exportData, importData } from '../../services/api';

type Tab = 'providers' | 'general' | 'data';

export default function SettingsDialog() {
  const { settingsOpen, setSettingsOpen, settings, saveSettings } = useAppStore();
  const [tab, setTab] = useState<Tab>('providers');
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [selectedProviderId, setSelectedProviderId] = useState(settings.activeProviderId);
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  // DB path state
  const [dbPath, setDbPath] = useState('');
  const [defaultDbPath, setDefaultDbPath] = useState('');
  const [dbPathSaving, setDbPathSaving] = useState(false);
  const [dbPathMsg, setDbPathMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (settingsOpen) {
      setDraft(settings);
      setSelectedProviderId(settings.activeProviderId);
      setPos(null);
      setDbPathMsg(null);
      // Load current DB path from server
      fetch('/api/config').then(r => r.json()).then(d => {
        setDbPath(d.dbPath || '');
        setDefaultDbPath(d.defaultDbPath || '');
      }).catch(() => {});
    }
  }, [settingsOpen]);

  // Escape key
  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSettingsOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [settingsOpen]);

  const handleDragStart = (e: React.MouseEvent) => {
    if (!dialogRef.current) return;
    if ((e.target as HTMLElement).closest('button, input, select, textarea')) return;
    e.preventDefault();
    const rect = dialogRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    const w = rect.width, h = rect.height;
    const onMove = (ev: MouseEvent) => {
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - w, ev.clientX - offsetX)),
        y: Math.max(0, Math.min(window.innerHeight - 60, ev.clientY - offsetY)),
      });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
    };
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  if (!settingsOpen) return null;

  const selectedProvider = draft.providers.find(p => p.id === selectedProviderId);

  const updateProvider = (id: string, patch: Partial<ProviderConfig>) => {
    setDraft(d => ({
      ...d,
      providers: d.providers.map(p => p.id === id ? { ...p, ...patch } : p),
    }));
  };

  const addCustomProvider = () => {
    const id = `custom_${Date.now()}`;
    const newProvider: ProviderConfig = {
      id,
      name: 'Custom Provider',
      provider: 'openai',
      apiKey: '',
      baseUrl: '',
      model: '',
      contextLimit: 100000,
      maxTokens: 4096,
    };
    setDraft(d => ({ ...d, providers: [...d.providers, newProvider] }));
    setSelectedProviderId(id);
  };

  const removeProvider = (id: string) => {
    setDraft(d => ({
      ...d,
      providers: d.providers.filter(p => p.id !== id),
      activeProviderId: d.activeProviderId === id ? d.providers[0]?.id || '' : d.activeProviderId,
    }));
    if (selectedProviderId === id) {
      setSelectedProviderId(draft.providers[0]?.id || '');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings({ ...draft, activeProviderId: selectedProviderId });
      setSettingsOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDbPath = async () => {
    if (!dbPath.trim()) return;
    setDbPathSaving(true);
    setDbPathMsg(null);
    try {
      const r = await fetch('/api/config/db-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dbPath: dbPath.trim() }),
      });
      const d = await r.json();
      if (r.ok) {
        setDbPathMsg({ ok: true, text: 'Saved. Restart the server for the new database to take effect.' });
      } else {
        setDbPathMsg({ ok: false, text: d.error || 'Failed to save' });
      }
    } catch (e) {
      setDbPathMsg({ ok: false, text: String(e) });
    } finally {
      setDbPathSaving(false);
    }
  };

  const handleExport = async () => {
    const data = await exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tree-chat-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const data = JSON.parse(text);
      await importData(data);
      await useAppStore.getState().loadTopics();
      setSettingsOpen(false);
    };
    input.click();
  };

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      tab === t
        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
    }`;

  const dialogStyle = pos
    ? { position: 'fixed' as const, top: pos.y, left: pos.x, transform: 'none' }
    : { position: 'fixed' as const, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setSettingsOpen(false)} />

      {/* Dialog panel */}
      <div
        ref={dialogRef}
        className="z-50 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        style={dialogStyle}
        onClick={e => e.stopPropagation()}
      >
        {/* Header — drag handle */}
        <div
          className="flex items-center justify-between px-5 pt-5 pb-0 cursor-move select-none"
          onMouseDown={handleDragStart}
        >
          <h2 className="font-semibold text-base">Settings</h2>
          <button className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer" onClick={() => setSettingsOpen(false)}>
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-5 mt-3">
          <button className={tabClass('providers')} onClick={() => setTab('providers')}>Providers</button>
          <button className={tabClass('general')} onClick={() => setTab('general')}>General</button>
          <button className={tabClass('data')} onClick={() => setTab('data')}>Data</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── Providers tab ── */}
          {tab === 'providers' && (
            <div className="flex gap-4 h-full">
              {/* Provider list */}
              <div className="w-44 flex-shrink-0 space-y-1">
                {draft.providers.map(p => (
                  <div
                    key={p.id}
                    className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                      selectedProviderId === p.id
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                    onClick={() => setSelectedProviderId(p.id)}
                  >
                    <span className="flex-1 truncate">{p.name}</span>
                    {/* Show active indicator */}
                    {draft.activeProviderId === p.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" title="Active" />
                    )}
                    {/* Can't delete the 3 built-in providers */}
                    {!DEFAULT_PROVIDERS.find(d => d.id === p.id) && (
                      <button
                        className="opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-red-500"
                        onClick={e => { e.stopPropagation(); removeProvider(p.id); }}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  onClick={addCustomProvider}
                >
                  <Plus size={13} /> Custom
                </button>
              </div>

              {/* Provider form */}
              <div className="flex-1 min-w-0">
                {selectedProvider ? (
                  <>
                    {/* Set as active */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-medium">{selectedProvider.name}</span>
                      <button
                        className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                          draft.activeProviderId === selectedProvider.id
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                        onClick={() => setDraft(d => ({ ...d, activeProviderId: selectedProvider.id }))}
                      >
                        {draft.activeProviderId === selectedProvider.id ? '✓ Active' : 'Set as Active'}
                      </button>
                    </div>

                    {/* Provider type selector (only for custom) */}
                    {!DEFAULT_PROVIDERS.find(d => d.id === selectedProvider.id) && (
                      <div className="mb-3">
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Adapter Type</label>
                        <select
                          className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 outline-none"
                          value={selectedProvider.provider}
                          onChange={e => updateProvider(selectedProvider.id, { provider: e.target.value as ProviderConfig['provider'] })}
                        >
                          <option value="openai">OpenAI-compatible</option>
                          <option value="anthropic">Anthropic</option>
                          <option value="qianwen">Qianwen (DashScope)</option>
                        </select>
                      </div>
                    )}

                    <ProviderForm
                      config={selectedProvider}
                      onChange={patch => updateProvider(selectedProvider.id, patch)}
                    />
                  </>
                ) : (
                  <p className="text-sm text-gray-400">Select a provider</p>
                )}
              </div>
            </div>
          )}

          {/* ── General tab ── */}
          {tab === 'general' && (
            <div className="space-y-5 max-w-md">
              <div>
                <label className="block text-sm font-medium mb-1">Theme</label>
                <select
                  className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 outline-none"
                  value={draft.theme}
                  onChange={e => setDraft(d => ({ ...d, theme: e.target.value as AppSettings['theme'] }))}
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">System Prompt</label>
                <textarea
                  className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 outline-none resize-none"
                  rows={5}
                  placeholder="Optional system instructions for the AI…"
                  value={draft.systemPrompt}
                  onChange={e => setDraft(d => ({ ...d, systemPrompt: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Node Name Generation</label>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400">Language</label>
                    <select
                      className="mt-1 w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 outline-none"
                      value={draft.nodeName.language}
                      onChange={e => setDraft(d => ({ ...d, nodeName: { ...d.nodeName, language: e.target.value as AppSettings['nodeName']['language'] } }))}
                    >
                      <option value="auto">Auto (match input language)</option>
                      <option value="en">English</option>
                      <option value="zh">Chinese</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400">Max English words</label>
                      <input
                        type="number" min={1} max={10}
                        className="mt-1 w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 outline-none"
                        value={draft.nodeName.maxWords}
                        onChange={e => setDraft(d => ({ ...d, nodeName: { ...d.nodeName, maxWords: Number(e.target.value) } }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400">Max Chinese chars</label>
                      <input
                        type="number" min={1} max={20}
                        className="mt-1 w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 outline-none"
                        value={draft.nodeName.maxChars}
                        onChange={e => setDraft(d => ({ ...d, nodeName: { ...d.nodeName, maxChars: Number(e.target.value) } }))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Data tab ── */}
          {tab === 'data' && (
            <div className="space-y-5 max-w-md">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Export all your chats and settings as a JSON file, or import a previously exported file.
                Importing will <strong>replace</strong> all existing data.
              </p>

              <div className="flex gap-3">
                <button
                  className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  onClick={handleExport}
                >
                  <Download size={15} /> Export data
                </button>
                <button
                  className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  onClick={handleImport}
                >
                  <Upload size={15} /> Import data
                </button>
              </div>

              {/* Database path */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium">Database Path</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Location of the SQLite database file. Change takes effect after server restart.
                  </p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 text-xs font-mono px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 outline-none focus:border-blue-400"
                    value={dbPath}
                    onChange={e => { setDbPath(e.target.value); setDbPathMsg(null); }}
                    placeholder={defaultDbPath || 'Enter full path to .db file…'}
                  />
                  <button
                    className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-50"
                    onClick={handleSaveDbPath}
                    disabled={dbPathSaving || !dbPath.trim()}
                  >
                    {dbPathSaving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
                  </button>
                </div>
                {defaultDbPath && (
                  <p className="text-xs text-gray-400">
                    Default: <span className="font-mono">{defaultDbPath}</span>
                    {dbPath !== defaultDbPath && (
                      <button className="ml-2 underline text-blue-500" onClick={() => { setDbPath(defaultDbPath); setDbPathMsg(null); }}>
                        Reset
                      </button>
                    )}
                  </p>
                )}
                {dbPathMsg && (
                  <p className={`text-xs ${dbPathMsg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                    {dbPathMsg.text}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            className="px-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            onClick={() => setSettingsOpen(false)}
          >
            Cancel
          </button>
          <button
            className="px-5 py-2 text-sm rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-60"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </>
  );
}
