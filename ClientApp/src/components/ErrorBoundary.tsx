import { Component } from 'react';
import { logger } from '../lib/logger';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
    children: ReactNode;
    /** Optional fallback UI — if not provided, a default error card is shown */
    fallback?: ReactNode;
    /** Scope label for logging (e.g. "AdminDashboard") */
    scope?: string;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

/**
 * React Error Boundary — catches render errors in descendant tree.
 *
 * IMPORTANT: This prevents a single component crash from tearing down
 * the entire app (which would destroy AuthContext and force re-login).
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        const scope = this.props.scope ?? 'Unknown';
        logger.error(`[ErrorBoundary:${scope}] Caught render error:`, error);
        logger.error(`[ErrorBoundary:${scope}] Component stack:`, errorInfo.componentStack);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                    <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-8 max-w-lg w-full text-center">
                        <div className="size-14 rounded-xl bg-red-100 flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="text-red-500" size={28} />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Something went wrong
                        </h3>
                        <p className="text-sm text-gray-500 mb-1">
                            This section encountered an unexpected error and couldn't render.
                        </p>
                        {this.state.error && (
                            <p className="text-xs text-red-400 font-mono bg-red-50 rounded-lg px-3 py-2 mt-3 mb-4 break-all">
                                {this.state.error.message}
                            </p>
                        )}
                        <button
                            onClick={this.handleRetry}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700 transition-colors mt-2"
                        >
                            <RefreshCw size={14} />
                            Try Again
                        </button>
                        <p className="text-xs text-gray-400 mt-4">
                            Your session is safe — you are still logged in.
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
