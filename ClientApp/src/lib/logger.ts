/**
 * Production-safe logger.
 * In development all messages pass through to the real console.
 * In production every method is a silent no-op.
 */

const isDev = import.meta.env.DEV;

/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function noop(..._args: any[]): void { /* silent */ }

export const logger = {
    log:   isDev ? console.log.bind(console)   : noop,
    warn:  isDev ? console.warn.bind(console)  : noop,
    error: isDev ? console.error.bind(console) : noop,
    info:  isDev ? console.info.bind(console)  : noop,
    debug: isDev ? console.debug.bind(console) : noop,
} as const;
