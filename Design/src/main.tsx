import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './styles/index.css';

const isIframeMessageAbortError = (err: any) => {
  if (!err) return false;
  if (typeof err === 'string' && (err.includes('IframeMessageAbortError') || err.includes('message port was destroyed'))) return true;
  if (err.name === 'IframeMessageAbortError' || err.message?.includes('IframeMessageAbortError') || err.message?.includes('message port was destroyed')) return true;
  try {
    const str = String(err);
    if (str.includes('IframeMessageAbortError') || str.includes('message port was destroyed')) return true;
  } catch (e) {}
  return false;
};

// Safely ignore transient IframeMessageAbortError logs at the window level
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  if (args.some(isIframeMessageAbortError)) {
    return;
  }
  originalConsoleError(...args);
};

const originalConsoleWarn = console.warn;
console.warn = (...args: any[]) => {
  if (args.some(isIframeMessageAbortError)) {
    return;
  }
  originalConsoleWarn(...args);
};

window.addEventListener('error', (event) => {
  if (
    isIframeMessageAbortError(event) ||
    isIframeMessageAbortError(event.error) ||
    isIframeMessageAbortError(event.message)
  ) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (isIframeMessageAbortError(event.reason)) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
