/** Waitlist helpers for the marketing site (Resend). */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BRAND = {
  bg: '#0E0C0A',
  surface: '#17140F',
  ink: '#F2EADC',
  inkMuted: '#9A8E7E',
  accent: '#E39A3C',
  border: '#3E362C',
  markUrl: 'https://www.atasoif.fr/mark.svg',
  siteUrl: 'https://www.atasoif.fr',
} as const;

export function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  return EMAIL_RE.test(email);
}

export function buildUserAckEmail(): { subject: string; html: string; text: string } {
  const subject = 'C’est noté, on te prévient à la sortie';
  const text = [
    'À ta soif',
    '',
    'Salut,',
    '',
    'Ton email est bien enregistré pour la liste d’attente.',
    'On t’écrit une seule fois, quand l’app sort sur iOS et Android.',
    '',
    'Pas de newsletter. Pas de spam.',
    '',
    'L’équipe À ta soif',
    BRAND.siteUrl,
  ].join('\n');

  const html = wrapEmailHtml({
    preheader: 'Ton email est enregistré. Un seul message à la sortie.',
    eyebrow: 'Liste d’attente',
    title: 'C’est noté.',
    bodyHtml: [
      '<p style="margin:0 0 14px;">Salut,</p>',
      '<p style="margin:0 0 14px;">Ton email est bien enregistré. On t’écrit <strong style="color:#F2EADC;font-weight:600;">une seule fois</strong>, quand l’app sort sur iOS et Android.</p>',
      '<p style="margin:0;">Pas de newsletter. Pas de spam.</p>',
    ].join(''),
    footer: 'L’équipe À ta soif',
  });

  return { subject, html, text };
}

export function buildNotifyEmail(subscriberEmail: string): {
  subject: string;
  html: string;
  text: string;
} {
  const safe = escapeHtml(subscriberEmail);
  const subject = `[Waitlist] ${subscriberEmail}`;
  const text = [
    'À ta soif · nouvelle inscription waitlist',
    '',
    `Email : ${subscriberEmail}`,
    '',
    BRAND.siteUrl,
  ].join('\n');

  const html = wrapEmailHtml({
    preheader: `Nouvelle inscription : ${subscriberEmail}`,
    eyebrow: 'Waitlist',
    title: 'Nouvelle inscription',
    bodyHtml: [
      '<p style="margin:0 0 14px;">Quelqu’un vient de s’inscrire sur la liste d’attente.</p>',
      `<p style="margin:0;padding:14px 16px;border:1px solid ${BRAND.border};background:${BRAND.bg};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;letter-spacing:0.02em;word-break:break-all;">${safe}</p>`,
    ].join(''),
    footer: 'Notification interne · atasoif.fr',
  });

  return { subject, html, text };
}

function wrapEmailHtml(opts: {
  preheader: string;
  eyebrow: string;
  title: string;
  bodyHtml: string;
  footer: string;
}): string {
  const { preheader, eyebrow, title, bodyHtml, footer } = opts;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="dark" />
<title>À ta soif</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};color:${BRAND.ink};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${BRAND.surface};border:1px solid ${BRAND.border};">
        <tr>
          <td style="padding:28px 28px 0;">
            <img src="${BRAND.markUrl}" width="28" height="42" alt="À ta soif" style="display:block;border:0;" />
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px 0;font-family:Georgia,'Times New Roman',serif;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND.accent};">
            À ta soif · ${escapeHtml(eyebrow)}
          </td>
        </tr>
        <tr>
          <td style="padding:12px 28px 0;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.15;letter-spacing:-0.02em;color:${BRAND.ink};">
            ${escapeHtml(title)}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 0;height:1px;">
            <div style="height:1px;background:${BRAND.border};line-height:1px;font-size:1px;">&nbsp;</div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:${BRAND.ink};">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.45;color:${BRAND.inkMuted};">
            ${escapeHtml(footer)}<br />
            <a href="${BRAND.siteUrl}" style="color:${BRAND.accent};text-decoration:none;">atasoif.fr</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`.trim();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
