import { Loader2 } from 'lucide-react';
import { type CSSProperties, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/ui/cn';
import {
  type PercentWeights,
  type PreferenceSelection,
  PRESET_PROFILES,
  preferenceKey,
  redistributeWeights,
  selectionWeights,
  WEIGHT_KEYS,
  WEIGHT_STEP,
  type WeightKey,
} from './preferences';

/** Espera tras el último movimiento de un slider antes de reordenar (sin una petición por paso). */
const SLIDER_COMMIT_MS = 300;

const PROFILE_OPTIONS = [...PRESET_PROFILES, 'CUSTOM'] as const;

export interface PreferenceSelectorProps {
  /** Perfil a mostrar: el que se está pidiendo o, si no hay ninguno, el vigente. */
  selection: PreferenceSelection;
  onChange: (selection: PreferenceSelection) => void;
  /** Búsqueda vencida o campo bloqueado. */
  disabled?: boolean;
  isPending?: boolean;
  /** Etiqueta accesible o leyenda personalizada cuando se usa fuera del podio (p. ej. Mi cuenta). */
  legend?: string;
  /** Oculta visualmente la leyenda cuando la tarjeta padre ya tiene título propio. */
  hideLegend?: boolean;
  /** Columnas de las píldoras de perfil: `2` en paneles estrechos, `4` en páginas amplias. */
  columns?: 2 | 4;
  /** Aviso de vencida o error de `/rank`, bajo el control. */
  notice?: ReactNode;
}

export function PreferenceSelector({
  selection,
  onChange,
  disabled = false,
  isPending = false,
  legend,
  hideLegend = false,
  columns = 2,
  notice,
}: PreferenceSelectorProps) {
  const { t } = useTranslation();
  const name = useId();
  const hintId = useId();
  const timer = useRef<number | undefined>(undefined);

  // Borrador de los sliders: responde en cada movimiento y se resincroniza si el perfil cambia
  // desde fuera (otro perfil, o vuelta atrás tras un error).
  const key = preferenceKey(selection);
  const [draft, setDraft] = useState<PercentWeights>(() => selectionWeights(selection));
  const [draftKey, setDraftKey] = useState(key);
  if (draftKey !== key) {
    setDraftKey(key);
    setDraft(selectionWeights(selection));
  }

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const handleProfile = (profile: (typeof PROFILE_OPTIONS)[number]) => {
    window.clearTimeout(timer.current);
    // Personalizado arranca con los pesos del perfil activo.
    onChange(
      profile === 'CUSTOM' ? { profile, weights: selectionWeights(selection) } : { profile },
    );
  };

  const handleSlider = (weightKey: WeightKey, value: number) => {
    const next = redistributeWeights(draft, weightKey, value);
    setDraft(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(
      () => onChange({ profile: 'CUSTOM', weights: next }),
      SLIDER_COMMIT_MS,
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <fieldset disabled={disabled} className="flex flex-col gap-2">
        <legend
          className={
            hideLegend ? 'sr-only' : 'mb-2 flex items-center gap-2 text-sm font-semibold text-fg'
          }
        >
          {legend ?? t('podium.preferences.legend')}
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin text-fg-muted" aria-hidden="true" />
          ) : null}
        </legend>
        <div
          className={cn(
            'grid grid-cols-2 gap-1 rounded-lg bg-surface-sunken p-1',
            columns === 4 && 'sm:grid-cols-4',
          )}
        >
          {PROFILE_OPTIONS.map((profile) => {
            const checked = selection.profile === profile;
            return (
              <label
                key={profile}
                className={cn(
                  'relative inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-2 text-center text-xs font-semibold transition-colors duration-150 ease-(--ease-out) select-none sm:min-h-9',
                  'has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-1 has-focus-visible:ring-offset-surface-sunken',
                  'has-disabled:cursor-not-allowed has-disabled:opacity-60',
                  checked
                    ? 'border-primary bg-surface text-fg shadow-xs'
                    : 'border-transparent text-fg-muted hover:text-fg',
                )}
              >
                <input
                  type="radio"
                  name={name}
                  value={profile}
                  checked={checked}
                  onChange={() => handleProfile(profile)}
                  className="sr-only"
                />
                {t(`podium.preferences.profiles.${profile}`)}
              </label>
            );
          })}
        </div>

        {selection.profile === 'CUSTOM' ? (
          <div
            role="group"
            aria-label={t('podium.preferences.customLabel')}
            aria-describedby={hintId}
            className="mt-1 flex flex-col gap-2 rounded-lg border border-line p-3"
          >
            <p id={hintId} className="text-xs text-fg-muted">
              {t('podium.preferences.customHint')}
            </p>
            {WEIGHT_KEYS.map((weightKey) => {
              const inputId = `${name}-${weightKey}`;
              return (
                <div key={weightKey} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <label htmlFor={inputId} className="text-sm text-fg">
                      {t(`podium.preferences.weights.${weightKey}`)}
                    </label>
                    <output
                      htmlFor={inputId}
                      className="text-sm font-semibold text-fg tabular-nums"
                    >
                      {draft[weightKey]} %
                    </output>
                  </div>
                  <input
                    id={inputId}
                    type="range"
                    min={0}
                    max={100}
                    step={WEIGHT_STEP}
                    value={draft[weightKey]}
                    aria-valuetext={`${draft[weightKey]} %`}
                    onChange={(event) => handleSlider(weightKey, Number(event.target.value))}
                    style={{ '--value': draft[weightKey] } as CSSProperties}
                    className="navby-range h-8 w-full cursor-pointer disabled:cursor-not-allowed sm:h-6"
                  />
                </div>
              );
            })}
          </div>
        ) : null}
      </fieldset>
      {notice}
    </div>
  );
}
