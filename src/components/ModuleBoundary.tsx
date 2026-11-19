import { Component, type ReactNode } from 'react';

export class ModuleBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div role="alert" className="p-8 text-slate-200 space-y-4">
        <p>
          No se pudo abrir este módulo. Puedes abrir otra sección o recargar para recuperar la
          versión actual.
        </p>
        <button className="rounded bg-blue-600 px-4 py-2" onClick={() => window.location.reload()}>
          Recargar CRM
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
