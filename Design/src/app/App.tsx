import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { queryClient } from './lib/queryClient';
import { AppRouter } from './routes';
import './i18n';

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

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    if (isIframeMessageAbortError(error)) {
      return { hasError: false }; // Try to ignore it
    }
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    if (!isIframeMessageAbortError(error)) {
      originalConsoleError("Uncaught error:", error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return <div>Something went wrong. Please refresh the page.</div>;
    }
    return this.props.children;
  }
}

// Main application entry point
export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppRouter />
        <Toaster position="top-right" />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
