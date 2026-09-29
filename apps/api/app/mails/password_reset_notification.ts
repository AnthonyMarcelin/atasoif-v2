import type User from '#models/user'
import env from '#start/env'
import { BaseMail } from '@adonisjs/mail'
import { renderNuitEmailHtml } from '#mails/nuit_email_layout'

export default class PasswordResetNotification extends BaseMail {
  from = {
    address: env.get('MAIL_FROM_ADDRESS'),
    name: env.get('MAIL_FROM_NAME'),
  }
  subject = 'Réinitialise ton mot de passe · À ta soif'

  constructor(
    private user: User,
    private resetUrl: string
  ) {
    super()
  }

  prepare() {
    const greeting = this.user.fullName ? `Salut ${this.user.fullName},` : 'Salut,'

    this.message
      .to(this.user.email)
      .html(
        renderNuitEmailHtml({
          previewText: 'Tu as demandé un nouveau mot de passe pour ta cave.',
          title: 'Nouveau mot de passe',
          bodyHtml: `<p style="margin:0 0 12px;">${greeting}</p>
<p style="margin:0 0 12px;">Tu as demandé à réinitialiser ton mot de passe. Clique ci-dessous pour en choisir un nouveau.</p>
<p style="margin:0;">Le lien expire dans 1&nbsp;h. Si ce n’était pas toi, ignore ce message.</p>`,
          ctaLabel: 'Choisir un nouveau mot de passe',
          ctaUrl: this.resetUrl,
          footerNote:
            'Tu n’as rien demandé ? Pas d’inquiétude · ton mot de passe actuel reste inchangé.',
        })
      )
      .text(
        [
          'Réinitialise ton mot de passe · À ta soif',
          '',
          greeting,
          '',
          'Tu as demandé à réinitialiser ton mot de passe.',
          '',
          `Ouvre ce lien (valable 1 h) : ${this.resetUrl}`,
          '',
          'Tu n’as rien demandé ? Ignore ce message · ton mot de passe reste inchangé.',
        ].join('\n')
      )
  }
}
