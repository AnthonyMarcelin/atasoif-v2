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
  test('user ack is French, branded, and non-marketing', () => {
    const mail = buildUserAckEmail();
    expect(mail.subject.toLowerCase()).toContain('noté');
    expect(mail.subject).not.toContain('—');
    expect(mail.subject).not.toContain('–');
    expect(mail.text).toContain('une seule fois');
    expect(mail.text).toContain('Pour nous écrire : contact@atasoif.fr');
    expect(mail.text).toContain('À ta soif');
    expect(mail.text).not.toContain('—');
    expect(mail.html).toContain('À ta soif');
    expect(mail.html).toContain('mailto:contact@atasoif.fr');
    expect(mail.html).toContain('Pour nous écrire');
    expect(mail.html).toContain('#0E0C0A');
    expect(mail.html).toContain('#E39A3C');
    expect(mail.html).toContain('https://www.atasoif.fr/mark.svg');
    expect(mail.html).toContain('C’est noté.');
    expect(mail.html).not.toContain('—');
    expect(mail.html).not.toContain('newsletter marketing');
  });

  test('notify escapes html and keeps Nuit branding', () => {
    const mail = buildNotifyEmail('evil<script>@x.fr');
    expect(mail.html).toContain('evil&lt;script&gt;@x.fr');
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('#0E0C0A');
    expect(mail.html).toContain('Nouvelle inscription');
    expect(mail.text).toContain('evil<script>@x.fr');
  });
});
