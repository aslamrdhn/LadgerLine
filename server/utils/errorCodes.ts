export const ERROR_CODES = {
  INV_001: { code: 'INV-001', status: 400, message: 'Stock not enough', category: 'BUSINESS' },
  INV_002: { code: 'INV-002', status: 409, message: 'Stock was modified concurrently', category: 'SYSTEM' },
  INV_003: { code: 'INV-003', status: 404, message: 'FIFO layer not found', category: 'SYSTEM' },
  VAL_001: { code: 'VAL-001', status: 400, message: 'Items and payments cannot be empty', category: 'VALIDATION' },
  VAL_002: { code: 'VAL-002', status: 400, message: 'Menu not found', category: 'VALIDATION' },
  VAL_003: { code: 'VAL-003', status: 400, message: 'Warehouse not found', category: 'VALIDATION' },
  VAL_004: { code: 'VAL-004', status: 400, message: 'Invalid money format', category: 'VALIDATION' },
  AUT_001: { code: 'AUT-001', status: 401, message: 'Unauthorized', category: 'SECURITY' },
  AUT_002: { code: 'AUT-002', status: 403, message: 'Insufficient permissions', category: 'SECURITY' },
  TEN_001: { code: 'TEN-001', status: 404, message: 'Tenant not found', category: 'BUSINESS' },
  SUB_001: { code: 'SUB-001', status: 403, message: 'Subscription expired', category: 'BUSINESS' },
  PER_001: { code: 'PER-001', status: 403, message: 'Period is closed', category: 'BUSINESS' },
  PER_002: { code: 'PER-002', status: 400, message: 'Period not found', category: 'VALIDATION' },
  NUM_001: { code: 'NUM-001', status: 500, message: 'Number generation failed', category: 'SYSTEM' },
  NUM_002: { code: 'NUM-002', status: 400, message: 'Number already used', category: 'VALIDATION' },
  REV_001: { code: 'REV-001', status: 403, message: 'Reversal not allowed', category: 'BUSINESS' },
  ARC_001: { code: 'ARC-001', status: 500, message: 'Google Drive upload failed', category: 'EXTERNAL' },
  SYS_001: { code: 'SYS-001', status: 500, message: 'Internal server error', category: 'SYSTEM' },
} as const;

export class LedgerError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly category: string;
  constructor(code: keyof typeof ERROR_CODES, customMessage?: string) {
    const err = ERROR_CODES[code];
    super(customMessage || err.message);
    this.code = err.code;
    this.status = err.status;
    this.category = err.category;
    this.name = 'LedgerError';
  }
}
