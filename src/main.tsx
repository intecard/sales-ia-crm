import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { WorkspaceApp } from './components/WorkspaceApp';
import App from './App.tsx';
import './index.css';
import { SaaSAccessGate } from './components/SaaSAccessGate.tsx';

document.documentElement.dataset.theme=localStorage.getItem('sales-ai-theme')||'dark';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SaaSAccessGate>{(session) => session.demo ? <App /> : <WorkspaceApp organizationId={session.organizationId!} />}</SaaSAccessGate>
  </StrictMode>,
);
