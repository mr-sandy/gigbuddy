import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppBootstrap } from './app-bootstrap.js';
import { ErrorBoundary } from './components/error-boundary.js';
import { applyBootAtmosphere } from './lib/atmosphere.js';
import { startErrorReporter } from './lib/error-reporter.js';
import { SyncProvider } from './sync/query-client.js';
import './styles/globals.css';

applyBootAtmosphere();
startErrorReporter();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found');

createRoot(rootElement).render(
  <StrictMode>
    <SyncProvider>
      <ErrorBoundary>
        <AppBootstrap />
      </ErrorBoundary>
    </SyncProvider>
  </StrictMode>,
);
