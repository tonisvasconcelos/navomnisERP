import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { usePlatformAuthStore } from '@/store/auth-store';
import { platformApi } from '@/lib/platform-api';

const nav = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/tenants', label: 'Tenants' },
  { to: '/users', label: 'Users' },
  { to: '/subscriptions/plans', label: 'Subscriptions' },
  { to: '/telemetry', label: 'Telemetry' },
  { to: '/legal', label: 'Legal' },
  { to: '/lgpd', label: 'LGPD' },
  { to: '/audit', label: 'Audit' },
  { to: '/features', label: 'Features' },
];

export function AdminShell() {
  const navigate = useNavigate();
  const { displayName, email, clear } = usePlatformAuthStore();

  const logout = async () => {
    try {
      await platformApi.post('/platform/auth/logout');
    } catch {
      /* ignore */
    }
    clear();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r border-slate-800 bg-slate-900 p-4">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest text-slate-500">Navomnis</p>
          <h1 className="text-lg font-semibold text-white">Platform Admin</h1>
        </div>
        <nav className="flex flex-col gap-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded px-3 py-2 text-sm ${isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-800 px-6 py-3">
          <p className="text-sm text-slate-400">SaaS command center</p>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-300">{displayName ?? email}</span>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded bg-slate-800 px-3 py-1 text-sm hover:bg-slate-700"
            >
              Sair
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
