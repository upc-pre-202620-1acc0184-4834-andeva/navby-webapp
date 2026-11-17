import {
  Bookmark,
  ChevronDown,
  Coins,
  LogIn,
  LogOut,
  Moon,
  Sun,
  User,
  UserCog,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useSearchParams } from 'react-router';
import { sileo } from 'sileo';
import isologoPurple from '@/assets/brand/navby-isologo-purple.svg';
import isologoWhite from '@/assets/brand/navby-isologo-white.svg';
import { resolveAuthRedirectFrom } from '@/shared/auth/authRedirect';
import { apiErrorMessage } from '@/shared/api/errorMessage';
import { useLogout, useSession } from '@/shared/auth/useSession';
import { buttonVariants } from '@/shared/ui/buttonVariants';
import { cn } from '@/shared/ui/cn';
import { useTheme } from '@/shared/ui/theme';

const MENU_ITEM_CLASS =
  'flex min-h-11 sm:min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-fg transition-colors duration-150 ease-(--ease-out) hover:bg-surface-sunken';

function getInitials(fullName: string, email: string): string {
  const source = fullName.trim() || email.trim();
  return source.charAt(0).toUpperCase() || 'N';
}

export function TopBar() {
  const { t, i18n } = useTranslation();
  const { user, isPending, isAuthenticated } = useSession();
  const { theme, setTheme } = useTheme();
  const logout = useLogout();
  const [isOpen, setIsOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const routeKey = `${location.pathname}${location.search}`;
  const [prevRouteKey, setPrevRouteKey] = useState(routeKey);
  if (prevRouteKey !== routeKey) {
    setPrevRouteKey(routeKey);
    if (isOpen) {
      setIsOpen(false);
    }
  }

  const currentLang = (i18n.resolvedLanguage ?? i18n.language).startsWith('en') ? 'en' : 'es';
  const redirectFrom = resolveAuthRedirectFrom(location);

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

  const handleLanguageChange = (nextLang: 'es' | 'en') => {
    void i18n.changeLanguage(nextLang);
    if (searchParams.has('lang')) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('lang');
      setSearchParams(nextParams, { replace: true });
    }
  };

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-line bg-surface sm:h-16">
      <div className="mx-auto flex h-full max-w-[90rem] items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          to="/"
          aria-label={t('nav.homeAria')}
          className="inline-flex min-h-11 items-center rounded-lg py-1"
        >
          <img
            src={isologoPurple}
            alt=""
            aria-hidden="true"
            className="h-7 w-auto sm:h-8 dark:hidden"
          />
          <img
            src={isologoWhite}
            alt=""
            aria-hidden="true"
            className="hidden h-7 w-auto sm:h-8 dark:block"
          />
        </Link>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <Link
              to="/billing"
              aria-label={t('nav.creditsAria')}
              className={cn(
                buttonVariants({ variant: 'secondary', size: 'md' }),
                'rounded-full px-3 text-xs tabular-nums',
              )}
            >
              <Coins className="h-4 w-4 text-brand-ink" aria-hidden="true" />
              <span>{t('nav.creditsPlaceholder')}</span>
            </Link>
          ) : null}

          <div ref={containerRef} className="relative">
            <button
              ref={triggerRef}
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              aria-label={t('nav.accountMenu')}
              onClick={() => setIsOpen((prev) => !prev)}
              className={cn(
                buttonVariants({ variant: 'secondary', size: 'md' }),
                'gap-2 px-3 sm:px-3.5',
              )}
            >
              {isPending ? (
                <User className="h-4 w-4 text-fg-muted" aria-hidden="true" />
              ) : isAuthenticated && user ? (
                <>
                  <span
                    aria-hidden="true"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary-dark"
                  >
                    {getInitials(user.full_name, user.email)}
                  </span>
                  <span className="hidden max-w-36 truncate sm:inline">{user.full_name}</span>
                </>
              ) : (
                <>
                  <User className="h-4 w-4 text-fg-muted" aria-hidden="true" />
                  <span className="hidden sm:inline">{t('nav.accountLabel')}</span>
                </>
              )}
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-fg-muted transition-transform duration-150 ease-(--ease-out)',
                  isOpen && 'rotate-180',
                )}
                aria-hidden="true"
              />
            </button>

            <div
              id={panelId}
              inert={!isOpen ? true : undefined}
              aria-hidden={!isOpen}
              className={cn(
                'absolute top-[calc(100%+8px)] right-0 z-40 w-72 origin-top-right rounded-xl border border-line bg-surface p-2 shadow-lg',
                'transition-[opacity,transform,visibility] ease-(--ease-out)',
                isOpen
                  ? 'visible scale-100 opacity-100 duration-150'
                  : 'pointer-events-none invisible scale-95 opacity-0 duration-125',
              )}
            >
              {isAuthenticated && user ? (
                <div className="mb-1 border-b border-line px-3 py-2">
                  <p className="truncate text-sm font-semibold text-fg">{user.full_name}</p>
                  <p className="truncate text-xs text-fg-muted">{user.email}</p>
                </div>
              ) : null}

              <nav aria-label={t('nav.accountMenu')} className="flex flex-col gap-0.5">
                {isAuthenticated ? (
                  <>
                    <Link
                      to="/itineraries"
                      className={MENU_ITEM_CLASS}
                      onClick={() => setIsOpen(false)}
                    >
                      <Bookmark className="h-4 w-4 text-fg-muted" aria-hidden="true" />
                      <span>{t('nav.itineraries')}</span>
                    </Link>
                    <Link
                      to="/billing"
                      className={MENU_ITEM_CLASS}
                      onClick={() => setIsOpen(false)}
                    >
                      <Wallet className="h-4 w-4 text-fg-muted" aria-hidden="true" />
                      <span>{t('nav.billing')}</span>
                    </Link>
                    <Link
                      to="/account"
                      className={MENU_ITEM_CLASS}
                      onClick={() => setIsOpen(false)}
                    >
                      <UserCog className="h-4 w-4 text-fg-muted" aria-hidden="true" />
                      <span>{t('nav.account')}</span>
                    </Link>
                    <button
                      type="button"
                      disabled={logout.isPending}
                      aria-busy={logout.isPending || undefined}
                      className={cn(MENU_ITEM_CLASS, 'disabled:opacity-50')}
                      onClick={() =>
                        logout.mutate(undefined, {
                          onSuccess: () => setIsOpen(false),
                          onError: (error) =>
                            sileo.error({
                              title: t('account.logoutFailed'),
                              description: apiErrorMessage(t, error),
                            }),
                        })
                      }
                    >
                      <LogOut className="h-4 w-4 text-fg-muted" aria-hidden="true" />
                      <span>{t('nav.signOut')}</span>
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      state={redirectFrom ? { from: redirectFrom } : undefined}
                      className={MENU_ITEM_CLASS}
                      onClick={() => setIsOpen(false)}
                    >
                      <LogIn className="h-4 w-4 text-brand-ink" aria-hidden="true" />
                      <span>{t('nav.signIn')}</span>
                    </Link>
                    <Link
                      to="/register"
                      state={redirectFrom ? { from: redirectFrom } : undefined}
                      className={MENU_ITEM_CLASS}
                      onClick={() => setIsOpen(false)}
                    >
                      <UserPlus className="h-4 w-4 text-fg-muted" aria-hidden="true" />
                      <span>{t('nav.signUp')}</span>
                    </Link>
                  </>
                )}
              </nav>

              <div className="mt-2 flex flex-col gap-2.5 border-t border-line px-3 pt-3 pb-1">
                <p className="text-xs font-semibold text-fg-muted">{t('nav.preferences')}</p>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-fg">{t('nav.themeLabel')}</span>
                  <div
                    role="group"
                    aria-label={t('nav.themeLabel')}
                    className="grid grid-cols-2 gap-1 rounded-lg bg-surface-sunken p-1"
                  >
                    <button
                      type="button"
                      aria-pressed={theme === 'light'}
                      onClick={() => setTheme('light')}
                      className={cn(
                        'inline-flex min-h-11 items-center justify-center gap-1 rounded-md px-2.5 text-xs font-semibold transition-colors duration-150 ease-(--ease-out) sm:min-h-9',
                        theme === 'light'
                          ? 'border border-line bg-surface text-fg shadow-xs'
                          : 'border border-transparent text-fg-muted hover:text-fg',
                      )}
                    >
                      <Sun className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t('nav.themeLight')}</span>
                    </button>
                    <button
                      type="button"
                      aria-pressed={theme === 'dark'}
                      onClick={() => setTheme('dark')}
                      className={cn(
                        'inline-flex min-h-11 items-center justify-center gap-1 rounded-md px-2.5 text-xs font-semibold transition-colors duration-150 ease-(--ease-out) sm:min-h-9',
                        theme === 'dark'
                          ? 'border border-line bg-surface text-fg shadow-xs'
                          : 'border border-transparent text-fg-muted hover:text-fg',
                      )}
                    >
                      <Moon className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t('nav.themeDark')}</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-fg">{t('nav.languageLabel')}</span>
                  <div
                    role="group"
                    aria-label={t('nav.languageLabel')}
                    className="grid grid-cols-2 gap-1 rounded-lg bg-surface-sunken p-1"
                  >
                    <button
                      type="button"
                      aria-label="Español"
                      aria-pressed={currentLang === 'es'}
                      onClick={() => handleLanguageChange('es')}
                      className={cn(
                        'inline-flex min-h-11 items-center justify-center rounded-md px-3 text-xs font-semibold transition-colors duration-150 ease-(--ease-out) sm:min-h-9',
                        currentLang === 'es'
                          ? 'border border-line bg-surface text-fg shadow-xs'
                          : 'border border-transparent text-fg-muted hover:text-fg',
                      )}
                    >
                      {t('nav.langEs')}
                    </button>
                    <button
                      type="button"
                      aria-label="English"
                      aria-pressed={currentLang === 'en'}
                      onClick={() => handleLanguageChange('en')}
                      className={cn(
                        'inline-flex min-h-11 items-center justify-center rounded-md px-3 text-xs font-semibold transition-colors duration-150 ease-(--ease-out) sm:min-h-9',
                        currentLang === 'en'
                          ? 'border border-line bg-surface text-fg shadow-xs'
                          : 'border border-transparent text-fg-muted hover:text-fg',
                      )}
                    >
                      {t('nav.langEn')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
