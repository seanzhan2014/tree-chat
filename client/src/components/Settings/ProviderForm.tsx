import { useState } from 'react';
import { CheckCircle, XCircle, Loader, RefreshCw } from 'lucide-react';
import type { ProviderConfig } from '../../types';
import { testProvider, fetchModels } from '../../services/api';

interface Props {
  config: ProviderConfig;
  onChange: (patch: Partial<ProviderConfig>) => void;
}

type TestState = 'idle' | 'testing' | 'ok' | 'fail';

export default function ProviderForm({ config, onChange }: Props) {
  const [testState, setTestState] = useState<TestState>('idle');
  const [testError, setTestError] = useState('');
  const [testLatency, setTestLatency] = useState(0);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);

  const handleTest = async () => {
    if (!config.apiKey) return;
    setTestState('testing');
    setTestError('');
    try {
      const result = await testProvider(config);
      if (result.ok) {
        setTestState('ok');
        setTestLatency(result.latency);
      } else {
        setTestState('fail');
        setTestError(result.error || 'Connection failed');
      }
    } catch (e: unknown) {
      setTestState('fail');
      setTestError((e as Error).message);
    }
  };

  const handleFetchModels = async () => {
    if (!config.apiKey) return;
    setFetchingModels(true);
    try {
      const list = await fetchModels(config);
      setModels(list);
    } catch (e: unknown) {
      setTestError((e as Error).message);
    } finally {
      setFetchingModels(false);
    }
  };

  const field = (label: string, key: keyof ProviderConfig, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 outline-none focus:border-blue-400 transition-colors"
        placeholder={placeholder}
        value={String(config[key] ?? '')}
        onChange={e => {
          const val = type === 'number' ? Number(e.target.value) : e.target.value;
          onChange({ [key]: val });
          setTestState('idle');
        }}
      />
    </div>
  );

  return (
    <div className="space-y-3">
      {field('Display Name', 'name', 'text', 'My Provider')}
      {field('API Key', 'apiKey', 'password', 'sk-...')}
      {field('Base URL', 'baseUrl', 'text', 'https://api.openai.com')}

      {/* Model selector */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Model</label>
        <div className="flex gap-2">
          {models.length > 0 ? (
            <select
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 outline-none"
              value={config.model}
              onChange={e => onChange({ model: e.target.value })}
            >
              {models.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 outline-none focus:border-blue-400 transition-colors"
              placeholder="gpt-4o"
              value={config.model}
              onChange={e => onChange({ model: e.target.value })}
            />
          )}
          <button
            className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
            disabled={!config.apiKey || fetchingModels}
            onClick={handleFetchModels}
            title="Fetch available models"
          >
            <RefreshCw size={13} className={fetchingModels ? 'animate-spin' : ''} />
            Fetch
          </button>
        </div>
      </div>

      {/* Context limit & max tokens */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Context limit (tokens)</label>
          <input
            type="number"
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 outline-none"
            value={config.contextLimit}
            onChange={e => onChange({ contextLimit: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Max output tokens</label>
          <input
            type="number"
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 outline-none"
            value={config.maxTokens}
            onChange={e => onChange({ maxTokens: Number(e.target.value) })}
          />
        </div>
      </div>

      {/* Test connection */}
      <div className="flex items-center gap-3 pt-1">
        <button
          className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
          disabled={!config.apiKey || testState === 'testing'}
          onClick={handleTest}
        >
          {testState === 'testing' ? (
            <Loader size={14} className="animate-spin" />
          ) : (
            <span>Test Connection</span>
          )}
        </button>

        {testState === 'ok' && (
          <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-sm">
            <CheckCircle size={14} /> OK · {testLatency}ms
          </span>
        )}
        {testState === 'fail' && (
          <span className="flex items-center gap-1.5 text-red-500 text-sm">
            <XCircle size={14} /> {testError || 'Failed'}
          </span>
        )}
      </div>
    </div>
  );
}
