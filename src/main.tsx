import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { PublicCardPayment } from './components/PublicCardPayment.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {window.location.pathname.startsWith('/pagar/') ? <PublicCardPayment/> : <App />}
  </StrictMode>,
);
