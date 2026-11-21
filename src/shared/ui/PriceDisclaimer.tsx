import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from './cn';

export interface PriceDisclaimerProps {
  text?: string;
  note?: string;
  className?: string;
}

/** Aviso legal obligatorio junto a toda tarifa (RL-03, US-31). */
export function PriceDisclaimer({ text, note, className }: PriceDisclaimerProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn('flex items-start gap-1.5 text-xs leading-relaxed text-fg-muted', className)}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex flex-col gap-0.5">
        <p>{text ?? t('legal.priceDisclaimer')}</p>
        {note ? <p>{note}</p> : null}
      </div>
    </div>
  );
}
