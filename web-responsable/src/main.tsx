import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { SessionProvider } from './session';
import './styles.css';
import { ToastProvider } from './composants/ui';
import { ThemeProvider } from './composants/Theme';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <ThemeProvider><ToastProvider><Suspense fallback={<div className="plein-ecran" role="status" aria-label="Chargement de la page"><span className="spinner" /></div>}><App /></Suspense></ToastProvider></ThemeProvider>
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
);
