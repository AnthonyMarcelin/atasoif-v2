/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_CTA_MODE?: 'waitlist' | 'stores';
  readonly PUBLIC_IOS_URL?: string;
  readonly PUBLIC_ANDROID_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace NodeJS {
  interface ProcessEnv {
    readonly RESEND_API_KEY?: string;
    readonly RESEND_FROM?: string;
    readonly RESEND_REPLY_TO?: string;
    readonly WAITLIST_NOTIFY_TO?: string;
  }
}
