import { useTranslation } from 'react-i18next';
import { Card } from '@/shared/ui/Card';

// shortcut: pantalla provisional de Plan 1 integrada en AppLayout; la reemplaza el buscador + mapa (Plan 2).
export function HomePage() {
  const { t } = useTranslation();

  return (
    <div className="grid flex-1 place-items-center px-4 py-8">
      <Card className="w-full max-w-md text-center">
        <h1 className="text-2xl font-bold text-fg">{t('home.title')}</h1>
        <p className="mt-2 text-sm text-fg-muted">{t('home.placeholder')}</p>
      </Card>
    </div>
  );
}
