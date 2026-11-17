import { type City } from '@/shared/api/schemas';

const OPENFLIGHTS_COUNTRY_ALIASES: Record<string, string> = {
  'american samoa': 'AS',
  'antigua and barbuda': 'AG',
  'bosnia and herzegovina': 'BA',
  'british virgin islands': 'VG',
  brunei: 'BN',
  burma: 'MM',
  'cape verde': 'CV',
  'cayman islands': 'KY',
  'central african republic': 'CF',
  'christmas island': 'CX',
  'cocos (keeling) islands': 'CC',
  'congo (brazzaville)': 'CG',
  'congo (kinshasa)': 'CD',
  'cook islands': 'CK',
  "cote d'ivoire": 'CI',
  'czech republic': 'CZ',
  'dominican republic': 'DO',
  'east timor': 'TL',
  'equatorial guinea': 'GQ',
  'falkland islands': 'FK',
  'faroe islands': 'FO',
  'french guiana': 'GF',
  'french polynesia': 'PF',
  'guinea-bissau': 'GW',
  'hong kong': 'HK',
  iran: 'IR',
  'isle of man': 'IM',
  laos: 'LA',
  macau: 'MO',
  macedonia: 'MK',
  'marshall islands': 'MH',
  micronesia: 'FM',
  moldova: 'MD',
  'netherlands antilles': 'BQ',
  'new caledonia': 'NC',
  'north korea': 'KP',
  'northern mariana islands': 'MP',
  'papua new guinea': 'PG',
  'puerto rico': 'PR',
  reunion: 'RE',
  russia: 'RU',
  'saint kitts and nevis': 'KN',
  'saint lucia': 'LC',
  'saint pierre and miquelon': 'PM',
  'saint vincent and the grenadines': 'VC',
  'sao tome and principe': 'ST',
  'saudi arabia': 'SA',
  'sierra leone': 'SL',
  'solomon islands': 'SB',
  'south africa': 'ZA',
  'south korea': 'KR',
  'south sudan': 'SS',
  'sri lanka': 'LK',
  swaziland: 'SZ',
  taiwan: 'TW',
  'trinidad and tobago': 'TT',
  turkey: 'TR',
  'turks and caicos islands': 'TC',
  'united arab emirates': 'AE',
  'united kingdom': 'GB',
  'united states': 'US',
  'virgin islands': 'VI',
  'wallis and futuna': 'WF',
  'western sahara': 'EH',
};

const SPECIAL_ES_OVERRIDES: Record<string, string> = {
  'netherlands antilles': 'Antillas Neerlandesas',
};

let cachedEnglishToIso: Map<string, string> | null = null;
const displayNamesCache: Partial<Record<'es' | 'en', Intl.DisplayNames>> = {};

function getDisplayNames(lang: 'es' | 'en'): Intl.DisplayNames | null {
  const existing = displayNamesCache[lang];
  if (existing) return existing;
  if (typeof Intl === 'undefined' || typeof Intl.DisplayNames !== 'function') {
    return null;
  }
  const created = new Intl.DisplayNames([lang], { type: 'region' });
  displayNamesCache[lang] = created;
  return created;
}

function getEnglishToIsoMap(): Map<string, string> {
  if (cachedEnglishToIso) return cachedEnglishToIso;

  const map = new Map<string, string>(Object.entries(OPENFLIGHTS_COUNTRY_ALIASES));
  const enDisplay = getDisplayNames('en');

  if (enDisplay) {
    const A_CODE = 65;
    for (let i = 0; i < 26; i += 1) {
      for (let j = 0; j < 26; j += 1) {
        const code = String.fromCharCode(A_CODE + i, A_CODE + j);
        const label = enDisplay.of(code);
        if (label && label !== code) {
          const normalized = label.trim().toLowerCase();
          if (!map.has(normalized)) {
            map.set(normalized, code);
          }
        }
      }
    }
  }

  cachedEnglishToIso = map;
  return map;
}

/** Traduce nombres de países devueltos en inglés por `/routing/cities` manteniendo el respaldo literal. */
export function localizeCountryName(englishCountry: string, lang: 'es' | 'en'): string {
  const clean = englishCountry.trim();
  if (!clean) return englishCountry;
  if (lang === 'en') return clean;

  const normalized = clean.toLowerCase();
  const special = SPECIAL_ES_OVERRIDES[normalized];
  if (special) return special;

  const isoCode = getEnglishToIsoMap().get(normalized);
  if (!isoCode) return clean;

  const esDisplay = getDisplayNames('es');
  return esDisplay?.of(isoCode) ?? clean;
}

export function formatCityLabel(city: City, lang: 'es' | 'en'): string {
  const cityName = lang === 'es' ? (city.city_es ?? city.city) : city.city;
  const countryName = localizeCountryName(city.country, lang);
  return `${cityName}, ${countryName}`;
}
