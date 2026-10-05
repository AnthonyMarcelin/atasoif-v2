import { describe, expect, test } from 'bun:test';
import {
  buildNotifyEmail,
  buildUserAckEmail,
  isValidEmail,
  normalizeEmail,
} from './waitlist';

describe('normalizeEmail', () => {
  test('trims and lowercases', () => {
    expect(normalizeEmail('  Foo@Example.FR ')).toBe('foo@example.fr');
  });

  test('rejects non-strings', () => {
    expect(normalizeEmail(null)).toBe('');
    expect(normalizeEmail(42)).toBe('');
  });
});

describe('isValidEmail', () => {
  test('accepts simple addresses', () => {
    expect(isValidEmail('toi@atasoif.fr')).toBe(true);
  });

  test('rejects empty or malformed', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('pas-un-email')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
  });
});

describe('email builders', () => {
  test('user ack is French and non-marketing', () => {
    const mail = buildUserAckEmail();
    expect(mail.subject.toLowerCase()).toContain('noté');
    expect(mail.text).toContain('une seule fois');
    expect(mail.html).toContain('À ta soif');
  });

  test('notify escapes html in address', () => {
    const mail = buildNotifyEmail('evil<script>@x.fr');
    expect(mail.html).toContain('evil&lt;script&gt;@x.fr');
    expect(mail.html).not.toContain('<script>');
  });
});
