import env from '#start/env'
import { defineConfig, transports } from '@adonisjs/mail'

const mailConfig = defineConfig({
  default: env.get('MAIL_MAILER'),

  from: {
    address: env.get('MAIL_FROM_ADDRESS'),
    name: env.get('MAIL_FROM_NAME'),
  },

  globals: {
    brandName: 'À ta soif',
  },

  mailers: {
    smtp: transports.smtp({
      host: env.get('SMTP_HOST'),
      port: env.get('SMTP_PORT'),
      /**
       * Mailpit (dev) needs no auth. Set SMTP_USERNAME / SMTP_PASSWORD for real SMTP.
       */
      ...(env.get('SMTP_USERNAME')
        ? {
            auth: {
              type: 'login' as const,
              user: env.get('SMTP_USERNAME')!,
              pass: env.get('SMTP_PASSWORD')!,
            },
          }
        : {}),
    }),
  },
})

export default mailConfig

declare module '@adonisjs/mail/types' {
  export interface MailersList extends InferMailers<typeof mailConfig> {}
}
