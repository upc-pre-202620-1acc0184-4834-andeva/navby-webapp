const DEFAULT_WEBSITE_URL = 'https://navby.andeva.tech';

export function getWebsiteUrl(): string {
  const configured = import.meta.env.VITE_WEBSITE_URL?.trim().replace(/\/+$/, '');
  return configured || DEFAULT_WEBSITE_URL;
}

export function getTermsUrl(): string {
  return `${getWebsiteUrl()}/terms`;
}

export function getPrivacyUrl(): string {
  return `${getWebsiteUrl()}/privacy`;
}
