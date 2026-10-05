import type User from '#models/user'
import env from '#start/env'
import { BaseMail } from '@adonisjs/mail'
import { renderNuitEmailHtml } from '#mails/nuit_email_layout'

export default class FriendRequestNotification extends BaseMail {
  from = {
    address: env.get('MAIL_FROM_ADDRESS'),
    name: env.get('MAIL_FROM_NAME'),
  }
  subject = 'Quelqu’un veut devenir ton ami · À ta soif'

  constructor(
    private recipient: User,
    private requester: User,
    private acceptUrl: string
  ) {
    super()
  }

  prepare() {
    const who = this.requester.pseudo || this.requester.fullName || 'Un ami'
    const greeting = this.recipient.fullName
      ? `Salut ${this.recipient.fullName},`
      : 'Salut,'

    this.message
      .to(this.recipient.email)
      .html(
        renderNuitEmailHtml({
          previewText: `${who} t’invite à partager vos caves.`,
          title: 'Demande d’ami',
          bodyHtml: `<p style="margin:0 0 12px;">${greeting}</p>
<p style="margin:0 0 12px;"><strong>${escapeHtml(who)}</strong> veut devenir ton ami sur À ta soif. Accepte pour voir vos caves (selon vos réglages de partage).</p>`,
          ctaLabel: 'Voir la demande',
          ctaUrl: this.acceptUrl,
          footerNote: 'Tu n’attendais pas ça ? Ignore le mail, rien ne se passe sans ton accord.',
        })
      )
      .text(
        [
          'Demande d’ami · À ta soif',
          '',
          greeting,
          '',
          `${who} veut devenir ton ami.`,
          `Ouvre ce lien : ${this.acceptUrl}`,
          '',
          'Ignore ce message si tu n’attendais pas cette demande.',
        ].join('\n')
      )
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
