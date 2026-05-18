import type { ReactNode } from 'react';

type Props<T> = {
  columns: string[];
  rows: T[];
  rowKey: (row: T) => string;
  getCells: (row: T) => (string | number | null | undefined)[];
  renderActions?: (row: T) => ReactNode;
  emptyMessage?: string;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  getCells,
  renderActions,
  emptyMessage = 'Nenhum registo encontrado.',
}: Props<T>) {
  const cols = renderActions ? [...columns, 'Ações'] : columns;

  if (!rows.length) {
    return (
      <p className="rounded border border-slate-800 bg-slate-900/50 px-4 py-8 text-center text-sm text-slate-400">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded border border-slate-800">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-900 text-slate-400">
          <tr>
            {cols.map((c) => (
              <th key={c} className="px-4 py-2 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-t border-slate-800 hover:bg-slate-900/50">
              {getCells(row).map((cell, j) => (
                <td key={j} className="px-4 py-2 text-slate-200">
                  {cell ?? '—'}
                </td>
              ))}
              {renderActions ? (
                <td className="px-4 py-2 text-slate-200">{renderActions(row)}</td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
