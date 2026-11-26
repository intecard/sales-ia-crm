import { useEffect, useState } from 'react';
type InstallEvent = Event & { prompt: () => Promise<{ outcome: 'accepted' | 'dismissed' }> };
let offered: InstallEvent | null = null;
if (typeof window !== 'undefined') {
  // Capture early enough for browsers that signal installability before the login panel mounts.
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    offered = event as InstallEvent;
  });
  window.addEventListener('appinstalled', () => { offered = null; });
}
export function InstallCRM() {
  const [available, setAvailable] = useState(() => Boolean(offered));
  const [opened, setOpened] = useState(false);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const detected = () => setAvailable(true);
    const done = () => { setInstalled(true); setAvailable(false); };
    window.addEventListener('beforeinstallprompt', detected);
    window.addEventListener('appinstalled', done);
    return () => {
      window.removeEventListener('beforeinstallprompt', detected);
      window.removeEventListener('appinstalled', done);
    };
  }, []);
  if (installed || window.matchMedia('(display-mode: standalone)').matches) return null;
  async function choose() {
    const prompt = offered;
    offered = null;
    setAvailable(false);
    if (!prompt) { setOpened(true); return; }
    try {
      const result = await prompt.prompt();
      if (result.outcome !== 'accepted') setOpened(true);
    } catch { setOpened(true); }
  }
  return (
    <div className="mt-5 border-t border-slate-700 pt-4 text-sm text-slate-300">
      <button type="button" onClick={() => void choose()} aria-expanded={opened}
        className="rounded-lg border border-cyan-800 px-3 py-2 font-semibold text-cyan-300 hover:bg-slate-800">
        {available ? 'Instalar Sales AI CRM' : 'Cómo instalar el CRM'}
      </button>
      {opened && <div className="mt-3 space-y-2">
        <p><strong>Computadora o Android:</strong> abre el menú de Chrome o Edge y elige la opción para instalar esta aplicación o añadirla a inicio.</p>
        <p><strong>iPhone o iPad:</strong> en Safari, abre Compartir y elige «Añadir a pantalla de inicio».</p>
        <p>La aplicación web usa el mismo CRM y requiere internet. Conserva el inicio de sesión y los permisos de tu cuenta.</p>
      </div>}
    </div>
  );
}
