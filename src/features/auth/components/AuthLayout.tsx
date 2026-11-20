import { Check, ChevronDown } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import cosmicHorizonBg from '@/assets/auth/cosmic-horizon.jpg';
import paperAirplaneImg from '@/assets/auth/paper-airplane.png';
import travelCompassImg from '@/assets/auth/travel-compass.png';
import isologoWhite from '@/assets/brand/navby-isologo-white.svg';
import { advanceAuthDesktopSide, commitAuthDesktopSide } from '@/shared/auth/authTransitionSide';
import { cn } from '@/shared/ui/cn';
import { LegalLinksRow } from '@/shared/ui/LegalLinks';
import { AuthShowcase, type AuthShowcaseVariant, type RegisterFeature } from './AuthShowcase';
import { LiquidBridge, type LiquidDirection } from './LiquidBridge';

export interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  variant: AuthShowcaseVariant;
  /** Enlace superior derecho estilo GitHub ("¿Ya tienes cuenta? Inicia sesión"). */
  headerAction?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Contenedor split-screen con transición líquida 60 fps al intercambiar columnas:
 * - `login` / `recovery`: formulario a la izquierda, globo `RouteGlobe` a la derecha.
 * - `register` / `verify`: showcase 3D a la izquierda, formulario a la derecha.
 * En móvil (< 1024 px): cabecera oscura compacta estilo GitHub con el ícono 3D sobre la costura
 * para mantener el formulario siempre por encima del pliegue.
 */
export function AuthLayout({
  title,
  subtitle,
  variant,
  headerAction,
  children,
  footer,
}: AuthLayoutProps) {
  const { t } = useTranslation();
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);
  const showcaseCardRef = useRef<HTMLDivElement | null>(null);

  const showcaseLeft = variant === 'register' || variant === 'verify';
  const currentSide = showcaseLeft ? 'left' : 'right';

  const [liquidState] = useState<{
    direction: LiquidDirection | null;
    key: number;
  }>(() => advanceAuthDesktopSide(currentSide));

  useEffect(() => {
    commitAuthDesktopSide(currentSide);
  }, [currentSide]);

  const registerFeatures = t('auth.showcase.register.features', {
    returnObjects: true,
  }) as RegisterFeature[];

  const mobileHeroAsset =
    variant === 'register' || variant === 'verify' ? paperAirplaneImg : travelCompassImg;

  return (
    <div className="relative grid min-h-dvh w-full overflow-x-clip bg-bg lg:grid-cols-2">
      <AuthShowcase
        variant={variant}
        cardRef={showcaseCardRef}
        className={cn(
          showcaseLeft ? 'lg:order-1' : 'lg:order-2',
          liquidState.direction ? 'navby-showcase-settle' : undefined,
        )}
      />

      <LiquidBridge
        direction={liquidState.direction}
        transitionKey={liquidState.key}
        targetCardRef={showcaseCardRef}
      />

      <div
        className={cn(
          'flex min-h-dvh flex-col justify-between lg:min-h-0',
          showcaseLeft ? 'lg:order-2' : 'lg:order-1',
          liquidState.direction === 'ltr' && 'navby-form-glide-ltr',
          liquidState.direction === 'rtl' && 'navby-form-glide-rtl',
        )}
      >
        {/* Cabecera móvil compacta estilo GitHub: banner oscuro + elemento 3D sobre la costura */}
        <div className="relative bg-[#12101B] px-5 pt-4 pb-11 text-white lg:hidden">
          <img
            src={cosmicHorizonBg}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover select-none"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[#12101B]/45"
          />

          <div className="relative z-10 flex items-center justify-between gap-2">
            <Link
              to="/login"
              aria-label={t('nav.homeAria')}
              className="inline-flex min-h-11 items-center rounded-lg py-1"
            >
              <img
                src={isologoWhite}
                alt=""
                aria-hidden="true"
                width={1295}
                height={580}
                className="h-6 w-auto"
              />
            </Link>

            {headerAction ? (
              <div className="text-xs text-[#D5D5E2] [&_a]:text-white [&_a]:underline [&_a]:underline-offset-4">
                {headerAction}
              </div>
            ) : null}
          </div>

          <div className="relative z-10 mt-3 max-w-md">
            <p className="text-xl font-bold tracking-tight text-white">
              {t(`auth.showcase.${variant}.headline`)}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#C6C6D4]">
              {t(`auth.showcase.${variant}.description`)}
            </p>

            {variant === 'register' ? (
              <div className="mt-2.5">
                <button
                  type="button"
                  aria-expanded={mobileDetailsOpen}
                  onClick={() => setMobileDetailsOpen((open) => !open)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/90 hover:text-white"
                >
                  <span>{t('auth.showcase.register.whatsIncluded')}</span>
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 transition-transform duration-150 ease-(--ease-out)',
                      mobileDetailsOpen && 'rotate-180',
                    )}
                    aria-hidden="true"
                  />
                </button>

                {mobileDetailsOpen && Array.isArray(registerFeatures) ? (
                  <ul className="mt-2 flex flex-col gap-1.5 pb-1">
                    {registerFeatures.map((item) => (
                      <li
                        key={item.title}
                        className="flex items-start gap-2 text-xs text-[#D5D5E2]"
                      >
                        <Check
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9D90FF]"
                          aria-hidden="true"
                        />
                        <span>{item.title}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>

          <img
            src={mobileHeroAsset}
            alt=""
            aria-hidden="true"
            className="navby-float-wave pointer-events-none absolute -bottom-8 left-1/2 z-20 h-18 w-auto -translate-x-1/2 drop-shadow-[0_12px_20px_rgba(0,0,0,0.45)] select-none"
          />
        </div>

        {/* Cabecera compacta en escritorio (≥ 1024 px) */}
        <header className="hidden items-center justify-end gap-3 px-10 pt-7 lg:flex">
          {headerAction ? <div className="text-sm text-fg-muted">{headerAction}</div> : null}
        </header>

        {/* Cuerpo del formulario centrado */}
        <div className="mx-auto my-auto flex w-full max-w-[400px] flex-col gap-6 px-5 pt-11 pb-6 sm:px-6 lg:px-0 lg:py-8">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-fg sm:text-[1.75rem]">{title}</h1>
            {subtitle ? <p className="text-sm leading-relaxed text-fg-muted">{subtitle}</p> : null}
          </div>

          <div className="flex flex-col gap-5">{children}</div>

          {footer ? <div className="text-center text-sm text-fg-muted">{footer}</div> : null}
        </div>

        {/* Enlaces legales discretos al pie de la columna de acceso */}
        <div className="flex justify-center px-5 pb-6 lg:px-10 lg:pb-7">
          <LegalLinksRow className="justify-center text-center" />
        </div>
      </div>
    </div>
  );
}
