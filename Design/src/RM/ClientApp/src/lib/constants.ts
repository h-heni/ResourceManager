/**
 * Canonical invoice status constants.
 * 
 * Business rules:
 * - PENDING: New invoice, no payments yet (or all payments deleted)
 * - PARTIALLY_PAID: Some payments completed, but total < invoice amount
 * - PAID: Total completed payments >= invoice amount
 * - ARCHIVED: Invoice has been marked as treated (Treated = true)
 *
 * The backend computes ARCHIVED from the `Treated` boolean flag.
 * In the database, the Status column holds PENDING | PARTIALLY_PAID | PAID.
 * The API response maps Treated → "Archived" for display purposes.
 */
export const INVOICE_STATUS = {
  PENDING: 'Pending',
  PARTIALLY_PAID: 'PartiallyPaid',
  PAID: 'Paid',
  ARCHIVED: 'Archived',
} as const;

export type InvoiceStatus = (typeof INVOICE_STATUS)[keyof typeof INVOICE_STATUS];

/** All possible invoice status values (for filters, selects, etc.) */
export const INVOICE_STATUS_VALUES: InvoiceStatus[] = [
  INVOICE_STATUS.PENDING,
  INVOICE_STATUS.PARTIALLY_PAID,
  INVOICE_STATUS.PAID,
  INVOICE_STATUS.ARCHIVED,
];
