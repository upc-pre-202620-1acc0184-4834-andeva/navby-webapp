import { useTranslation } from 'react-i18next';
import isologoPurple from '@/assets/brand/navby-isologo-purple.svg';
import isologoWhite from '@/assets/brand/navby-isologo-white.svg';

// shortcut: pantalla provisional para comprobar tokens, fuentes y tema; la reemplaza el buscador (US de búsqueda).
export function HomePage() {
  const { t } = useTranslation();

  return (
    <main className="grid min-h-dvh place-items-center bg-bg p-4 text-fg">
      <div className="flex flex-col items-center gap-4 text-center">
        <img src={isologoPurple} alt="Navby" className="h-10 w-auto dark:hidden" />
        <img src={isologoWhite} alt="Navby" className="hidden h-10 w-auto dark:block" />
        <p className="max-w-sm text-sm text-fg-muted">{t('home.placeholder')}</p>
      </div>
    </main>
  );
}
