import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

type BaseProps = {
  label: string;
  error?: string;
  hint?: string;
};

export function FormField({
  label,
  error,
  hint,
  children,
}: BaseProps & { children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm text-slate-300">{label}</label>
      {children}
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}

const inputClass =
  'w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-slate-500 focus:outline-none';

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}
