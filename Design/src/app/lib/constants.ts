export const APP_NAME = 'Resource Manager';
export const APP_VERSION = '1.0.0';

export const ROLES = {
  SUPER_ADMIN: 'SuperAdmin',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
} as const;

export const INVOICE_STATUS = {
  PENDING: 'Pending',
  PAID: 'Paid',
  PARTIALLY_PAID: 'PartiallyPaid',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
} as const;

export const QUOTE_STATUS = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
} as const;
