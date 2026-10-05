export const prerender = false;

import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import {
  buildNotifyEmail,
  buildUserAckEmail,
  isValidEmail,
  normalizeEmail,
} from '../../lib/waitlist';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[waitlist] RESEND_API_KEY is not configured');
    return json({ ok: false, message: 'Service indisponible pour le moment.' }, 503);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, message: 'Requête invalide.' }, 400);
  }

  const email =
    typeof payload === 'object' && payload !== null && 'email' in payload
      ? normalizeEmail((payload as { email: unknown }).email)
      : '';

  if (!isValidEmail(email)) {
    return json({ ok: false, message: 'Email invalide.' }, 400);
  }

  const from = process.env.RESEND_FROM ?? 'À ta soif <noreply@atasoif.fr>';
  const replyTo = process.env.RESEND_REPLY_TO ?? 'contact@atasoif.fr';
  // Empty string disables the internal notify copy.
  const notifyTo = process.env.WAITLIST_NOTIFY_TO ?? 'contact@atasoif.fr';

  const resend = new Resend(apiKey);
  const userMail = buildUserAckEmail();

  const { data, error } = await resend.emails.send({
    from,
    to: [email],
    replyTo,
    subject: userMail.subject,
    html: userMail.html,
    text: userMail.text,
    tags: [{ name: 'type', value: 'waitlist-ack' }],
  });

  if (error) {
    console.error('[waitlist] Resend ack failed', error);
    return json({ ok: false, message: 'Envoi impossible pour le moment.' }, 502);
  }

  if (notifyTo) {
    const notify = buildNotifyEmail(email);
    const { error: notifyError } = await resend.emails.send({
      from,
      to: [notifyTo],
      replyTo: email,
      subject: notify.subject,
      html: notify.html,
      text: notify.text,
      tags: [{ name: 'type', value: 'waitlist-notify' }],
    });
    if (notifyError) {
      // User already got the ack — log and continue.
      console.error('[waitlist] Resend notify failed', notifyError);
    }
  }

  return json({ ok: true, id: data?.id ?? null });
};
