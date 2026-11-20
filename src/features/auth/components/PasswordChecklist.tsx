import { Check, Circle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/ui/cn';

/**
 * Lista en vivo de requisitos de contraseña (inspirada en Quina).
 * Espeja las reglas de `authSchemas.ts`: 8-72 caracteres, letra y número.
 */
export function PasswordChecklist({ value }: { value: string }) {
  const { t } = useTranslation();

  const rules = [
    {
      key: 'length',
      label: t('auth.passwordRules.length'),
      met: value.length >= 8 && value.length <= 72,
    },
    {
      key: 'letter',
      label: t('auth.passwordRules.letter'),
      met: /\p{L}/u.test(value),
    },
    {
      key: 'number',
      label: t('auth.passwordRules.number'),
      met: /\p{N}/u.test(value),
    },
  ];

  return (
    <div className="rounded-lg border border-line bg-surface-sunken/70 px-3 py-2.5">
      <p className="mb-1.5 text-xs font-semibold text-fg">{t('auth.passwordRules.title')}</p>
      <ul className="flex flex-col gap-1">
        {rules.map((rule) => (
          <li
            key={rule.key}
            className={cn(
              'flex items-center gap-2 text-xs transition-colors duration-150 ease-(--ease-out)',
              rule.met ? 'font-medium text-success-ink' : 'text-fg-muted',
            )}
          >
            {rule.met ? (
              <Check className="h-3.5 w-3.5 shrink-0 stroke-[2.5]" aria-hidden="true" />
            ) : (
              <Circle className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
            )}
            <span>{rule.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
