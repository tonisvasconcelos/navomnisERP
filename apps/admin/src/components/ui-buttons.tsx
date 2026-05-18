import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export const btnPrimary =
  'inline-flex items-center rounded bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-500';
export const btnSecondary =
  'inline-flex items-center rounded border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800';
export const btnDanger =
  'inline-flex items-center rounded bg-red-800 px-3 py-2 text-sm text-white hover:bg-red-700';
export const btnLink = 'text-sm text-indigo-400 hover:text-indigo-300';

export function ActionLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={btnLink}>
      {children}
    </Link>
  );
}
