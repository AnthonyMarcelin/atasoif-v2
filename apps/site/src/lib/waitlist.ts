/** Waitlist helpers for the marketing site (Resend). */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  return EMAIL_RE.test(email);
}

export function buildUserAckEmail(): { subject: string; html: string; text: string } {
  const subject = 'C’est noté — on te prévient à la sortie';
  const text = [
    'Salut,',
    '',
    'Ton email est bien enregistré pour la liste d’attente À ta soif !',
    'On t’écrit une seule fois, quand l’app sort sur iOS et Android.',
    '',
    'Pas de newsletter. Pas de spam.',
    '',
    '— L’équipe À ta soif',
    'https://atasoif.fr',
  ].join('\n');

  const html = `
<p>Salut,</p>
<p>Ton email est bien enregistré pour la liste d’attente <strong>À ta soif&nbsp;!</strong></p>
<p>On t’écrit <strong>une seule fois</strong>, quand l’app sort sur iOS et Android.</p>
<p>Pas de newsletter. Pas de spam.</p>
<p>— L’équipe À ta soif<br /><a href="https://atasoif.fr">atasoif.fr</a></p>
`.trim();

  return { subject, html, text };
}

export function buildNotifyEmail(subscriberEmail: string): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `[Waitlist] ${subscriberEmail}`;
  const text = `Nouvelle inscription waitlist : ${subscriberEmail}`;
  const html = `<p>Nouvelle inscription waitlist&nbsp;: <strong>${escapeHtml(subscriberEmail)}</strong></p>`;
  return { subject, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
