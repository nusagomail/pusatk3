import { describe, expect, it } from 'vitest';
import { normalizeWhatsAppNumber, whatsappNumberSchema } from '../src/index';

describe('normalizeWhatsAppNumber', () => {
  it.each([
    ['0812 3456 7890', '6281234567890'],
    ['0812-3456-7890', '6281234567890'],
    ['+62 812-3456-7890', '6281234567890'],
    ['62 812 3456 7890', '6281234567890'],
    ['+62 (0)812-3456-7890', '6281234567890'],
    ['+62 0812 3456 7890', '6281234567890'],
    ['(021) 555-1234', '62215551234'],
  ])('%j → %j', (input, expected) => {
    expect(normalizeWhatsAppNumber(input)).toBe(expected);
  });

  it.each([
    '',
    '123',
    'abc',
    '0812-ABC-7890',
    '+1 555 0100 000',
    '0812345678901234567',
    '62',
    '+62 (0)',
  ])('rejects %j', (input) => {
    expect(normalizeWhatsAppNumber(input)).toBeNull();
  });

  it('never returns a number with 620 after the country code', () => {
    expect(normalizeWhatsAppNumber('+6208123456789')).toBe('628123456789');
  });
});

describe('whatsappNumberSchema', () => {
  it('normalises valid numbers and rejects invalid ones', () => {
    expect(whatsappNumberSchema.parse('0812-3456-7890')).toBe('6281234567890');
    expect(whatsappNumberSchema.safeParse('123').success).toBe(false);
  });
});
