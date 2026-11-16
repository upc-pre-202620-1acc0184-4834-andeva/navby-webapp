/// <reference types="vite/client" />

// Variables públicas: se incrustan en el bundle (ver .env.example).
interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_WEBSITE_URL: string;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  readonly VITE_API_PROXY_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
