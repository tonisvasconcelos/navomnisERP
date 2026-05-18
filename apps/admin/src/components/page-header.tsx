import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Props = {
  title: string;
  description?: string;
  backTo?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, description, backTo, actions }: Props) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        {backTo ? (
          <Link to={backTo} className="mb-2 inline-block text-sm text-slate-400 hover:text-white">
            ← Voltar
          </Link>
        ) : null}
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
