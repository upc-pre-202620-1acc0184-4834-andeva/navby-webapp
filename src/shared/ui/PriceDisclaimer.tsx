import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from './cn';

export interface PriceDisclaimerProps {
  text?: string;
  /** Líneas extra bajo el aviso; las vacías se omiten. */
  note?: string | null | ReadonlyArray<string | null | undefined>;
  className?: string;
}

/** Aviso legal obligatorio junto a toda tarifa (RL-03, US-31). */
export function PriceDisclaimer({ text, note, className }: PriceDisclaimerProps) {
  const { t } = useTranslation();
  const notes = [note ?? []].flat().filter(Boolean);

  return (
    <div
      className={cn('flex items-start gap-1.5 text-xs leading-relaxed text-fg-muted', className)}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex flex-col gap-0.5">
        <p>{text ?? t('legal.priceDisclaimer')}</p>
        {notes.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
  );
}
