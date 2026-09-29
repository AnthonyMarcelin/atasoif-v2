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
