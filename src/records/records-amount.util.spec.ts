import { BadRequestException } from '@nestjs/common';
import { parseRecordAmount } from './records-amount.util';

describe('parseRecordAmount', () => {
  it('accepts valid decimals', () => {
    expect(parseRecordAmount('100').toString()).toBe('100');
    expect(parseRecordAmount('  12.50  ').toString()).toBe('12.5');
  });

  it('rejects invalid strings', () => {
    expect(() => parseRecordAmount('abc')).toThrow(BadRequestException);
    expect(() => parseRecordAmount('12.3.4')).toThrow(BadRequestException);
  });
});
