import React, { useState } from 'react';
import {
  Bot,
  Building2,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react';
import { CRMAuthSession } from '../types';

interface AuthGateProps {
  deploymentMode: 'production' | 'trial';
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onAuthenticated: (session: CRMAuthSession) => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({ theme, onToggleTheme, onAuthenticated }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const handleRealLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok || !data.success || !data.session) {
        throw new Error(data.error || 'No se pudo iniciar sesión.');
      }

      onAuthenticated(data.session as CRMAuthSession);
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : 'No se pudo iniciar sesión. Verifica las credenciales.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.25),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,0.18),transparent_28%)]" />

      <div className="relative w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-6">
        <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 px-3 py-1 rounded-full text-xs font-black">
              <ShieldCheck className="w-4 h-4" />
              <span>Entrada real protegida</span>
            </div>
            <button
              type="button"
              onClick={onToggleTheme}
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
              title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-300" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-500" />
              )}
              <span>{theme === 'dark' ? 'Claro' : 'Oscuro'}</span>
            </button>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">SALES AI CRM</h1>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                CRM autónomo enterprise
              </p>
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
            Acceso real para operar INTECA y clientes con agentes IA 24/7.
          </h2>
          <p className="text-sm text-slate-400 mt-3 max-w-xl">
            La plataforma abre únicamente con usuario y contraseña reales. No hay acceso de prueba
            ni datos de muestra en esta versión.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
            {[
              'Ventas, pagos y seguimiento',
              'Marketing, Ads y embudos',
              'Auditoría, e-CF y contabilidad',
            ].map((item) => (
              <div
                key={item}
                className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs text-slate-300"
              >
                <Sparkles className="w-4 h-4 text-cyan-300 mb-2" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center gap-2 text-white mb-5">
            <LockKeyhole className="w-5 h-5 text-cyan-300" />
            <h2 className="text-lg font-black">Iniciar sesión real</h2>
          </div>

          <form onSubmit={handleRealLogin} className="space-y-4">
            <label className="block">
              <span className="text-xs font-bold text-slate-300">Correo administrador</span>
              <div className="mt-1 flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5">
                <Mail className="w-4 h-4 text-slate-500" />
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="admin@inteca.com.do"
                  className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-300">Contraseña</span>
              <div className="mt-1 flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5">
                <LockKeyhole className="w-4 h-4 text-slate-500" />
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Tu contraseña privada"
                  className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
                />
              </div>
            </label>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs rounded-xl p-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-60 disabled:cursor-wait text-white font-black rounded-xl px-4 py-3 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              <span>{isLoading ? 'Validando acceso...' : 'Entrar a la versión real'}</span>
            </button>
          </form>

          <div className="mt-5 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-400 flex gap-2">
            <Building2 className="w-4 h-4 text-cyan-300 flex-shrink-0 mt-0.5" />
            <p>
              Para producción en Render, configura `ADMIN_EMAIL` y `ADMIN_PASSWORD` en Environment.
              Esta versión solo permite entrada real.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};
