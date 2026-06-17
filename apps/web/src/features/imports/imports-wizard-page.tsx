import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';

type ImportBatch = {
  id: string;
  fileName: string;
  status: string;
  rowCount: number;
  errorCount: number;
};

function unwrap<T>(envelope: unknown): T {
  return ((envelope as { data?: T }).data ?? envelope) as T;
}

export function ImportsWizardPage() {
  const [batchId, setBatchId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState('');

  const batchQ = useQuery({
    queryKey: ['import-batch', batchId],
    enabled: Boolean(batchId),
    queryFn: async () => {
      const { data: envelope } = await api.get(`/imports/batches/${batchId}`);
      return unwrap<ImportBatch>(envelope);
    },
    refetchInterval: batchId ? 3000 : false,
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      form.append('companyId', companyId);
      form.append('fileType', 'SALES_CSV');
      form.append('idempotencyKey', `${file.name}-${file.size}-${Date.now()}`);
      const { data: envelope } = await api.post('/imports/batches', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return unwrap<ImportBatch>(envelope);
    },
    onSuccess: (b) => setBatchId(b.id),
  });

  const commit = useMutation({
    mutationFn: () => api.post(`/imports/batches/${batchId}/commit`),
    onSuccess: () => batchQ.refetch(),
  });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Importação CSV legado</h2>
      <p className="text-sm text-slate-500">cp1252, separador ; — vendas CADEG.</p>
      <label className="block text-sm">
        Company ID (UUID)
        <input
          className="mt-1 w-full max-w-md rounded border px-2 py-1 dark:bg-slate-900"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
        />
      </label>
      <input
        type="file"
        accept=".csv"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && companyId) upload.mutate(f);
        }}
      />
      {batchQ.data && (
        <div className="rounded-xl border p-4 text-sm">
          <p>
            <strong>{batchQ.data.fileName}</strong> — {batchQ.data.status}
          </p>
          <p>
            Linhas: {batchQ.data.rowCount} · Erros: {batchQ.data.errorCount}
          </p>
          {batchQ.data.status === 'READY_TO_COMMIT' && (
            <button
              type="button"
              className="mt-2 rounded bg-blue-600 px-3 py-1 text-white"
              onClick={() => commit.mutate()}
            >
              Confirmar commit
            </button>
          )}
        </div>
      )}
    </div>
  );
}
