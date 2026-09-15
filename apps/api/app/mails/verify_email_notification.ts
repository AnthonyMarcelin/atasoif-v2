import { BaseMail } from '@adonisjs/mail'
import type User from '#models/user'

export default class VerifyEmailNotification extends BaseMail {
  subject = 'Confirme ton email — À ta soif !'

  constructor(
    private user: User,
    private verifyUrl: string
  ) {
    super()
  }

  prepare() {
    const name = this.user.fullName || this.user.pseudo || 'toi'

    this.message.to(this.user.email).html(this.htmlBody(name)).text(this.textBody(name))
  }

  private htmlBody(name: string) {
    return `
      <p>Salut ${name},</p>
      <p>Bienvenue sur <strong>À ta soif !</strong> — confirme ton email pour qu’on sache que c’est bien toi.</p>
      <p><a href="${this.verifyUrl}">Confirmer mon email</a></p>
      <p>Ce lien expire dans 48&nbsp;h. Si tu n’as pas créé de compte, ignore ce message.</p>
      <p>— L’équipe À ta soif</p>
    `
  }

  private textBody(name: string) {
    return [
      `Salut ${name},`,
      '',
      'Bienvenue sur À ta soif ! — confirme ton email pour qu’on sache que c’est bien toi.',
      '',
      `Confirmer mon email : ${this.verifyUrl}`,
      '',
      'Ce lien expire dans 48 h. Si tu n’as pas créé de compte, ignore ce message.',
      '',
      '— L’équipe À ta soif',
    ].join('\n')
  }
}
