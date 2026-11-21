import { AlertTriangle, Bell, Coins, RotateCcw, type LucideIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { formatResetTime } from '@/features/billing/hooks/useWallet';
import { useIntlLocale } from '@/shared/i18n/useIntlLocale';
import { buttonVariants } from '@/shared/ui/buttonVariants';
import { cn } from '@/shared/ui/cn';
import { type AppNotification, formatRelative, useNotifications } from './useNotifications';

const ICONS: Record<AppNotification['kind'], { Icon: LucideIcon; tone: string }> = {
  'credits-empty': { Icon: Coins, tone: 'bg-warning/20 text-warning-ink' },
  purchase: { Icon: Coins, tone: 'bg-success/20 text-success-ink' },
  refund: { Icon: RotateCcw, tone: 'bg-primary-soft text-brand-ink' },
  reversal: { Icon: AlertTriangle, tone: 'bg-error/15 text-error-ink' },
};

export function NotificationsMenu({ userId, enabled }: { userId: string; enabled: boolean }) {
  const { t } = useTranslation();
  const locale = useIntlLocale();
  const location = useLocation();
  const { items, unreadIds, markAllSeen, isLoading } = useNotifications(userId, enabled);
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const routeKey = `${location.pathname}${location.search}`;
  const [prevRouteKey, setPrevRouteKey] = useState(routeKey);
  if (prevRouteKey !== routeKey) {
    setPrevRouteKey(routeKey);
    if (isOpen) setIsOpen(false);
  }

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Al cerrar el panel, lo que se vio deja de contar como nuevo.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (wasOpenRef.current && !isOpen) markAllSeen();
    wasOpenRef.current = isOpen;
  }, [isOpen, markAllSeen]);

  const unread = unreadIds.size;

  const describe = (item: AppNotification) => {
    switch (item.kind) {
      case 'credits-empty':
        return {
          title: t('notifications.creditsEmpty.title'),
          body: t('notifications.creditsEmpty.body', {
            time: formatResetTime(item.resetAt, locale),
          }),
          when: null,
        };
      default:
        return {
          title: t(`notifications.${item.kind}.title`, { count: item.credits }),
          body: t(`notifications.${item.kind}.body`),
          when: formatRelative(item.at, locale),
        };
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={t('notifications.triggerAria', { count: unread })}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(buttonVariants({ variant: 'secondary', size: 'icon' }), 'rounded-full')}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-surface bg-accent px-1 text-[10px] leading-none font-bold text-on-accent tabular-nums"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      <div
        id={panelId}
        role="region"
        aria-label={t('notifications.title')}
        inert={!isOpen ? true : undefined}
        aria-hidden={!isOpen}
        className={cn(
          'z-40 overscroll-contain rounded-xl border border-line bg-surface p-2 shadow-lg',
          'max-sm:fixed max-sm:inset-x-4 max-sm:top-16 sm:absolute sm:top-[calc(100%+8px)] sm:right-0 sm:w-80',
          'origin-top transition-[opacity,transform,visibility] ease-(--ease-out) motion-reduce:transition-[opacity,visibility] sm:origin-top-right',
          isOpen
            ? 'visible scale-100 opacity-100 duration-150'
            : 'pointer-events-none invisible scale-95 opacity-0 duration-125 motion-reduce:scale-100',
        )}
      >
        <h2 className="px-3 py-2 text-sm font-semibold text-fg">{t('notifications.title')}</h2>

        {items.length === 0 ? (
          <p className="px-3 pt-1 pb-3 text-sm text-fg-muted">
            {isLoading ? t('common.loading') : t('notifications.empty')}
          </p>
        ) : (
          <ul className="flex max-h-[min(24rem,70vh)] flex-col gap-0.5 overflow-y-auto">
            {items.map((item) => {
              const { Icon, tone } = ICONS[item.kind];
              const { title, body, when } = describe(item);
              const isNew = unreadIds.has(item.id);
              return (
                <li key={item.id}>
                  <Link
                    to="/billing"
                    className="flex gap-3 rounded-lg px-3 py-2.5 transition-colors duration-150 ease-(--ease-out) hover:bg-surface-sunken"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                        tone,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold text-fg">{title}</span>
                        {isNew ? (
                          <>
                            <span
                              aria-hidden="true"
                              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent"
                            />
                            <span className="sr-only">{t('notifications.new')}</span>
                          </>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-xs text-fg-muted">{body}</span>
                      {when ? (
                        <span className="mt-1 block text-xs text-fg-muted tabular-nums">
                          {when}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
