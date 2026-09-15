import { BaseMail } from '@adonisjs/mail'
import type User from '#models/user'

export default class PasswordResetNotification extends BaseMail {
  subject = 'Réinitialise ton mot de passe — À ta soif !'

  constructor(
    private user: User,
    private resetUrl: string
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
      <p>Tu as demandé à réinitialiser ton mot de passe sur <strong>À ta soif !</strong>.</p>
      <p><a href="${this.resetUrl}">Choisir un nouveau mot de passe</a></p>
      <p>Ce lien expire dans 1&nbsp;h. Si tu n’es pas à l’origine de cette demande, ignore ce message — ton mot de passe reste inchangé.</p>
      <p>— L’équipe À ta soif</p>
    `
  }

  private textBody(name: string) {
    return [
      `Salut ${name},`,
      '',
      'Tu as demandé à réinitialiser ton mot de passe sur À ta soif !',
      '',
      `Choisir un nouveau mot de passe : ${this.resetUrl}`,
      '',
      'Ce lien expire dans 1 h. Si tu n’es pas à l’origine de cette demande, ignore ce message — ton mot de passe reste inchangé.',
      '',
      '— L’équipe À ta soif',
    ].join('\n')
  }
}
