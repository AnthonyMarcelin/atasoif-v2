import type User from '#models/user'
import env from '#start/env'
import { BaseMail } from '@adonisjs/mail'
import { renderNuitEmailHtml } from '#mails/nuit_email_layout'

export default class VerifyEmailNotification extends BaseMail {
  from = {
    address: env.get('MAIL_FROM_ADDRESS'),
    name: env.get('MAIL_FROM_NAME'),
  }
  subject = 'Confirme ton adresse · À ta soif'

  constructor(
    private user: User,
    private verifyUrl: string
  ) {
    super()
  }

  prepare() {
    const greeting = this.user.fullName ? `Salut ${this.user.fullName},` : 'Salut,'

    this.message
      .to(this.user.email)
      .html(
        renderNuitEmailHtml({
          previewText: 'Confirme ton email pour garder ta cave en sécurité.',
          title: 'Confirme ton email',
          bodyHtml: `<p style="margin:0 0 12px;">${greeting}</p>
<p style="margin:0 0 12px;">Bienvenue dans ta cave. Un clic pour confirmer que c’est bien toi · on garde tes notes, prix et souvenirs à l’abri.</p>
<p style="margin:0;">Le lien expire dans 48&nbsp;h.</p>`,
          ctaLabel: 'Confirmer mon email',
          ctaUrl: this.verifyUrl,
          footerNote:
            'Tu n’as pas créé de compte À ta soif ? Ignore ce message, rien ne se passera.',
        })
      )
      .text(
        [
          'Confirme ton email · À ta soif',
          '',
          greeting,
          '',
          'Bienvenue dans ta cave. Confirme ton adresse pour garder tes notes, prix et souvenirs à l’abri.',
          '',
          `Ouvre ce lien (valable 48 h) : ${this.verifyUrl}`,
          '',
          'Tu n’as pas créé de compte ? Ignore ce message.',
        ].join('\n')
      )
  }
}
