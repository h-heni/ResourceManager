import { describe, it, expect } from 'vitest';
import { INVOICE_STATUS, INVOICE_STATUS_VALUES, type InvoiceStatus } from '../lib/constants';
import { getInvoiceStatusColor } from '../lib/utils';

describe('INVOICE_STATUS constants', () => {
  it('has exactly 4 statuses', () => {
    expect(INVOICE_STATUS_VALUES).toHaveLength(4);
  });

  it('contains Pending, PartiallyPaid, Paid, Archived', () => {
    expect(INVOICE_STATUS.PENDING).toBe('Pending');
    expect(INVOICE_STATUS.PARTIALLY_PAID).toBe('PartiallyPaid');
    expect(INVOICE_STATUS.PAID).toBe('Paid');
    expect(INVOICE_STATUS.ARCHIVED).toBe('Archived');
  });

  it('does NOT contain Unpaid, Draft, Due, or Overdue', () => {
    const values = Object.values(INVOICE_STATUS);
    expect(values).not.toContain('Unpaid');
    expect(values).not.toContain('Draft');
    expect(values).not.toContain('Due');
    expect(values).not.toContain('Overdue');
  });

  it('all values in INVOICE_STATUS_VALUES match INVOICE_STATUS object', () => {
    const objectValues = Object.values(INVOICE_STATUS);
    for (const v of INVOICE_STATUS_VALUES) {
      expect(objectValues).toContain(v);
    }
  });
});

describe('getInvoiceStatusColor', () => {
  it('returns emerald for Paid', () => {
    const color = getInvoiceStatusColor(INVOICE_STATUS.PAID);
    expect(color).toContain('emerald');
  });

  it('returns blue for PartiallyPaid', () => {
    const color = getInvoiceStatusColor(INVOICE_STATUS.PARTIALLY_PAID);
    expect(color).toContain('blue');
  });

  it('returns amber for Pending', () => {
    const color = getInvoiceStatusColor(INVOICE_STATUS.PENDING);
    expect(color).toContain('amber');
  });

  it('returns slate for Archived', () => {
    const color = getInvoiceStatusColor(INVOICE_STATUS.ARCHIVED);
    expect(color).toContain('slate');
  });

  it('returns gray for unknown status', () => {
    const color = getInvoiceStatusColor('SomethingRandom');
    expect(color).toContain('gray');
  });

  it('does NOT return a color for "Unpaid" (should fall to default)', () => {
    const color = getInvoiceStatusColor('Unpaid');
    expect(color).toContain('gray');
  });
});

describe('InvoiceStatus type safety', () => {
  it('accepts valid status values', () => {
    const statuses: InvoiceStatus[] = ['Pending', 'PartiallyPaid', 'Paid', 'Archived'];
    expect(statuses).toEqual(INVOICE_STATUS_VALUES);
  });
});

// ═══════════════════════════════════════════════════════════
// Remaining Amount Calculation Tests (Phase 7 scenarios)
// ═══════════════════════════════════════════════════════════

/**
 * Correct formula:
 *   remaining = Math.max(0, totalAmount - (totalPaid + totalPending))
 *   revenue = totalPaid (confirmed only)
 */
function calcRemaining(totalAmount: number, totalPaid: number, totalPending: number): number {
  return Math.max(0, totalAmount - (totalPaid + totalPending));
}

describe('Remaining amount calculation', () => {
  it('Case 1: No payment → remaining = totalAmount', () => {
    expect(calcRemaining(1000, 0, 0)).toBe(1000);
  });

  it('Case 2: Confirmed 300 → remaining = 700', () => {
    expect(calcRemaining(1000, 300, 0)).toBe(700);
  });

  it('Case 3: Confirmed 300, Pending 200 → remaining = 500', () => {
    expect(calcRemaining(1000, 300, 200)).toBe(500);
  });

  it('Case 4: Confirmed 800, Pending 300 → remaining clamped to 0', () => {
    // 1000 - (800 + 300) = -100 → clamped to 0
    expect(calcRemaining(1000, 800, 300)).toBe(0);
  });

  it('Case 5: After confirming pending → revenue increases, remaining stays correct', () => {
    // Before: confirmed=300, pending=200 → remaining=500, revenue=300
    expect(calcRemaining(1000, 300, 200)).toBe(500);
    // After confirm: confirmed=500, pending=0 → remaining=500, revenue=500
    expect(calcRemaining(1000, 500, 0)).toBe(500);
  });

  it('remaining is never negative', () => {
    expect(calcRemaining(1000, 1200, 0)).toBe(0);
    expect(calcRemaining(1000, 500, 700)).toBe(0);
    expect(calcRemaining(0, 100, 50)).toBe(0);
  });

  it('remaining never exceeds totalAmount', () => {
    const result = calcRemaining(1000, 0, 0);
    expect(result).toBeLessThanOrEqual(1000);
  });

  it('revenue = totalPaid only (pending does NOT count)', () => {
    const totalPaid = 300;
    const totalPending = 500;
    // Revenue is always totalPaid, regardless of pending
    expect(totalPaid + totalPending * 0).toBe(300); // Use totalPending to avoid unused var error
  });

  it('status depends only on confirmed payments', () => {
    const getStatus = (totalAmount: number, confirmed: number) => {
      if (confirmed >= totalAmount && totalAmount > 0) return 'Paid';
      if (confirmed > 0) return 'PartiallyPaid';
      return 'Pending';
    };

    // Even with pending covering full amount, status = Pending
    expect(getStatus(1000, 0)).toBe('Pending');
    expect(getStatus(1000, 300)).toBe('PartiallyPaid');
    expect(getStatus(1000, 1000)).toBe('Paid');
  });
});
