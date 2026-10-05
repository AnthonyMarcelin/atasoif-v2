import { digitsFromScan } from './barcode-scan.service';

describe('digitsFromScan', () => {
  it('keeps valid EAN digits and rejects noise', () => {
    expect(digitsFromScan('5010494000287')).toBe('5010494000287');
    expect(digitsFromScan('EAN 5010-4940-0028-7')).toBe('5010494000287');
    expect(digitsFromScan('123')).toBeNull();
    expect(digitsFromScan('')).toBeNull();
  });
});
