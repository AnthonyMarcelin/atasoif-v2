import type User from '#models/user'
import env from '#start/env'
import { BaseMail } from '@adonisjs/mail'
import { renderNuitEmailHtml } from '#mails/nuit_email_layout'

export default class MagicLinkNotification extends BaseMail {
  from = {
    address: env.get('MAIL_FROM_ADDRESS'),
    name: env.get('MAIL_FROM_NAME'),
  }
  subject = 'Ton lien magique · À ta soif'

  constructor(
    private user: User,
    private magicUrl: string
  ) {
    super()
  }

  prepare() {
    const greeting = this.user.fullName ? `Salut ${this.user.fullName},` : 'Salut,'

    this.message
      .to(this.user.email)
      .html(
        renderNuitEmailHtml({
          previewText: 'Un clic pour entrer dans ta cave.',
          title: 'Lien magique',
          bodyHtml: `<p style="margin:0 0 12px;">${greeting}</p>
<p style="margin:0 0 12px;">Voici ton lien pour te connecter sans mot de passe. Il expire dans 15&nbsp;minutes.</p>`,
          ctaLabel: 'Entrer dans ma cave',
          ctaUrl: this.magicUrl,
          footerNote: 'Tu n’as pas demandé ce lien ? Ignore ce message.',
        })
      )
      .text(
        [
          'Lien magique · À ta soif',
          '',
          greeting,
          '',
          'Clique pour te connecter (valable 15 min) :',
          this.magicUrl,
          '',
          'Tu n’as pas demandé ce lien ? Ignore ce message.',
        ].join('\n')
      )
  }
}
