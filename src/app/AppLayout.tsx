import { Loader2 } from 'lucide-react';
import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useMatches } from 'react-router';
import { cn } from '@/shared/ui/cn';
import { Footer } from './Footer';
import { TopBar } from './TopBar';

export type LayoutMode = 'default' | 'contained' | 'auth' | 'map';

export interface RouteLayoutHandle {
  layout?: LayoutMode;
}

export function AppLayout() {
  const { t } = useTranslation();
  const matches = useMatches();

  const layout: LayoutMode =
    [...matches]
      .reverse()
      .map((match) => (match.handle as RouteLayoutHandle | undefined)?.layout)
      .find((value): value is LayoutMode => value !== undefined) ?? 'default';

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white"
      >
        {t('common.skipToContent')}
      </a>

      <TopBar />

      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          'flex flex-1 flex-col focus:outline-none',
          layout === 'contained' && 'mx-auto w-full max-w-3xl px-4 py-6 sm:px-6',
          layout === 'auth' && 'mx-auto w-full max-w-sm justify-center px-4 py-8',
          layout === 'map' && 'relative overflow-x-clip',
        )}
      >
        <Suspense
          fallback={
            <div role="status" className="grid flex-1 place-items-center p-6 text-brand-ink">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
              <span className="sr-only">{t('common.loading')}</span>
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
