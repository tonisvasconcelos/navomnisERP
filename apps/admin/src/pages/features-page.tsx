import { useState } from 'react';
import { platformApi } from '@/lib/platform-api';

export function FeaturesPage() {
  const [tenantId, setTenantId] = useState('');
  const [moduleKey, setModuleKey] = useState('banking');
  const [enabled, setEnabled] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const save = async () => {
    if (!tenantId) {
      setMessage('Informe o tenant ID.');
      return;
    }
    try {
      await platformApi.post(`/platform/feature-flags/tenants/${tenantId}`, { moduleKey, enabled });
      setMessage('Override salvo.');
    } catch {
      setMessage('Falha ao salvar override.');
    }
  };

  return (
    <div className="max-w-lg">
      <h2 className="mb-4 text-xl font-semibold text-white">Feature flags</h2>
      <label className="mb-3 block text-sm text-slate-300">
        Tenant ID
        <input
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2"
        />
      </label>
      <label className="mb-3 block text-sm text-slate-300">
        Module key
        <input
          value={moduleKey}
          onChange={(e) => setModuleKey(e.target.value)}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2"
        />
      </label>
      <label className="mb-4 flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Habilitado
      </label>
      <button
        type="button"
        onClick={() => void save()}
        className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500"
      >
        Salvar override
      </button>
      {message && <p className="mt-3 text-sm text-slate-400">{message}</p>}
    </div>
  );
}
