import { Check, Compass, ShieldCheck, Sparkles } from 'lucide-react';
import { type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import cloudOffertImg from '@/assets/auth/cloud-offert.png';
import cosmicHorizonBg from '@/assets/auth/cosmic-horizon.jpg';
import paperAirplaneImg from '@/assets/auth/paper-airplane.png';
import travelCompassImg from '@/assets/auth/travel-compass.png';
import isologoWhite from '@/assets/brand/navby-isologo-white.svg';
import { getWebsiteUrl } from '@/shared/config/legalLinks';
import { cn } from '@/shared/ui/cn';
import { NAVBY_GLOBE_NIGHT } from './globeMath';
import { RouteGlobe } from './RouteGlobe';

export type AuthShowcaseVariant = 'login' | 'register' | 'verify' | 'recovery';

export interface RegisterFeature {
  title: string;
  detail: string;
}

/**
 * Panel lateral redondeado (estilo Quina) para escritorio (≥ 1024 px).
 * Se mantiene siempre en modo oscuro (#12101B) y cambia de lado según la ruta:
 * - `/login`, `/forgot-password`, `/reset-password` (derecha): globo interactivo `RouteGlobe`.
 * - `/register`, `/verify-email` (izquierda): fondo cósmico con los 3 elementos 3D transparentes
 *   repartidos con libertad (incluyendo salientes fuera del borde) y ondeo independiente.
 */
export function AuthShowcase({
  variant,
  className,
  cardRef,
}: {
  variant: AuthShowcaseVariant;
  className?: string;
  cardRef?: RefObject<HTMLDivElement | null>;
}) {
  const { t } = useTranslation();

  const registerFeatures = t('auth.showcase.register.features', {
    returnObjects: true,
  }) as RegisterFeature[];

  if (variant === 'login' || variant === 'recovery') {
    return (
      <aside className={cn('hidden p-4 lg:flex xl:p-5', className)}>
        <div
          ref={cardRef}
          className="relative flex flex-1 flex-col justify-between overflow-hidden rounded-3xl border border-white/10 text-white"
          style={{ background: NAVBY_GLOBE_NIGHT.ground }}
        >
          <RouteGlobe theme={NAVBY_GLOBE_NIGHT} className="!absolute inset-0" />

          {/* Velo superior sutil para que el titular siempre sea legible sobre el globo */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-48"
            style={{
              background:
                'linear-gradient(to bottom, #12101B 22%, rgba(18, 16, 27, 0.72) 65%, transparent 100%)',
            }}
          />

          {/* Cabecera y titular sobre el globo */}
          <div className="pointer-events-none relative z-10 flex flex-col gap-5 p-7 xl:p-9">
            <a
              href={getWebsiteUrl()}
              tabIndex={-1}
              aria-hidden="true"
              className="pointer-events-auto inline-flex w-fit items-center rounded-lg focus:outline-none"
            >
              <img
                src={isologoWhite}
                alt="Navby"
                width={1295}
                height={580}
                className="h-7 w-auto"
              />
            </a>

            <div className="max-w-sm">
              <h2 className="text-2xl font-bold tracking-tight text-white xl:text-[1.75rem] xl:leading-[1.2]">
                {t(`auth.showcase.${variant}.headline`)}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[#C6C6D4]">
                {t(`auth.showcase.${variant}.description`)}
              </p>
            </div>
          </div>

          {/* Tarjeta flotante inferior estilo Quina */}
          <div className="pointer-events-none relative z-10 p-6 xl:p-8">
            {variant === 'login' ? (
              <div className="max-w-xs rounded-2xl border border-white/12 bg-[#1B1828]/95 p-4 text-white shadow-2xl backdrop-blur-md">
                <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {t('auth.showcase.login.previewRoute')}
                    </p>
                    <p className="truncate text-xs text-[#B4B4C4]">
                      {t('auth.showcase.login.previewMeta')}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#604AFF]/25 px-2 py-0.5 text-[11px] font-semibold text-[#C8C0FF]">
                    <Compass className="h-3 w-3" aria-hidden="true" />
                    Top 3
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="inline-flex w-fit items-center rounded-full bg-[#FF6B35] px-2 py-0.5 text-[11px] font-bold text-[#262626]">
                      {t('auth.showcase.login.top1Badge')}
                    </span>
                    <span className="truncate text-xs text-[#D5D5E2]">
                      {t('auth.showcase.login.top1Details')}
                    </span>
                  </div>
                  <span className="shrink-0 text-xl font-extrabold text-white tabular-nums">
                    {t('auth.showcase.login.top1Price')}
                  </span>
                </div>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#1B1828]/95 px-3.5 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-md">
                <ShieldCheck className="h-4 w-4 text-[#9D90FF]" aria-hidden="true" />
                <span>{t('auth.showcase.recovery.badge')}</span>
              </div>
            )}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside aria-hidden="true" className={cn('hidden p-4 lg:flex xl:p-5', className)}>
      {/* Contenedor relativo sin overflow-hidden para que los elementos 3D sobresalgan con libertad */}
      <div className="relative flex flex-1 flex-col">
        {/* Tarjeta redondeada con el fondo cósmico recortado */}
        <div
          ref={cardRef}
          className="relative flex flex-1 flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-[#12101B] text-white"
        >
          <img
            src={cosmicHorizonBg}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover select-none"
          />

          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, rgba(18, 16, 27, 0.58) 0%, rgba(18, 16, 27, 0.16) 58%, transparent 100%)',
            }}
          />

          {/* Bloque superior de texto */}
          <div className="relative z-10 flex flex-col gap-6 p-8 xl:p-10">
            <a
              href={getWebsiteUrl()}
              tabIndex={-1}
              className="inline-flex w-fit items-center rounded-lg focus:outline-none"
            >
              <img
                src={isologoWhite}
                alt="Navby"
                width={1295}
                height={580}
                className="h-7 w-auto"
              />
            </a>

            {variant === 'register' ? (
              <div className="flex max-w-md flex-col gap-5 pr-10">
                <div className="flex flex-col gap-2">
                  <h2 className="text-2xl font-bold tracking-tight text-white xl:text-[1.85rem] xl:leading-[1.18]">
                    {t('auth.showcase.register.headline')}
                  </h2>
                  <p className="text-sm leading-relaxed text-[#C6C6D4]">
                    {t('auth.showcase.register.description')}
                  </p>
                </div>

                <ul className="flex flex-col gap-3">
                  {Array.isArray(registerFeatures)
                    ? registerFeatures.map((item) => (
                        <li key={item.title} className="flex items-start gap-2.5">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#604AFF]/25 text-[#9D90FF]">
                            <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                          </span>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-semibold text-white">{item.title}</span>
                            <span className="text-xs leading-relaxed text-[#B4B4C4]">
                              {item.detail}
                            </span>
                          </div>
                        </li>
                      ))
                    : null}
                </ul>
              </div>
            ) : (
              <div className="flex max-w-md flex-col gap-4 pr-10">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#C8C0FF]">
                  <Sparkles className="h-3.5 w-3.5 text-[#FF8A5C]" />
                  <span>{t('auth.showcase.verify.badge')}</span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-white xl:text-[1.85rem] xl:leading-[1.18]">
                  {t('auth.showcase.verify.headline')}
                </h2>
                <p className="text-sm leading-relaxed text-[#C6C6D4]">
                  {t('auth.showcase.verify.description')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Elementos 3D transparentes repartidos libremente y asomando fuera del borde */}
        <img
          src={paperAirplaneImg}
          alt=""
          className="navby-float-wave pointer-events-none absolute top-10 -right-5 z-20 w-36 drop-shadow-[0_18px_28px_rgba(0,0,0,0.45)] select-none xl:top-12 xl:-right-7 xl:w-44"
        />

        <img
          src={cloudOffertImg}
          alt=""
          className="navby-float-wave-slow pointer-events-none absolute bottom-6 -left-4 z-20 w-44 drop-shadow-[0_18px_28px_rgba(0,0,0,0.45)] select-none xl:bottom-8 xl:-left-6 xl:w-52"
        />

        <img
          src={travelCompassImg}
          alt=""
          className="navby-float-wave-delay pointer-events-none absolute right-6 -bottom-4 z-20 w-32 drop-shadow-[0_18px_28px_rgba(0,0,0,0.45)] select-none xl:right-10 xl:-bottom-5 xl:w-40"
        />
      </div>
    </aside>
  );
}
