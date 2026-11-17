import { Minus, Plus, Users } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/ui/cn';
import { Field } from '@/shared/ui/Field';
import { inputVariants } from '@/shared/ui/inputVariants';
import { MAX_PASSENGERS } from '../searchCriteria';
import { AnchoredPopover } from './AnchoredPopover';

export interface PassengersFieldProps {
  adults: number;
  childrenCount: number;
  infants: number;
  error?: string;
  onChange: (next: { adults: number; children: number; infants: number }) => void;
  onBlur?: () => void;
}

export function PassengersField({
  adults,
  childrenCount,
  infants,
  error,
  onChange,
  onBlur,
}: PassengersFieldProps) {
  const { t } = useTranslation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();
  const [open, setOpen] = useState(false);

  const total = adults + childrenCount + infants;

  const summaryParts = [
    t('search.adult', { count: adults }),
    ...(childrenCount > 0 ? [t('search.child', { count: childrenCount })] : []),
    ...(infants > 0 ? [t('search.infant', { count: infants })] : []),
  ];

  const handleClose = () => {
    setOpen(false);
    onBlur?.();
  };

  const minAdults = Math.max(1, infants);
  const maxAdults = MAX_PASSENGERS - childrenCount - infants;
  const maxChildren = Math.min(8, MAX_PASSENGERS - adults - infants);
  const maxInfants = Math.min(adults, MAX_PASSENGERS - adults - childrenCount);

  return (
    <Field label={t('search.passengersLabel')} error={error}>
      {({ id, 'aria-describedby': ariaDescribedBy, 'aria-invalid': ariaInvalid }) => (
        <div>
          <button
            ref={triggerRef}
            id={id}
            type="button"
            aria-expanded={open}
            aria-controls={open ? popoverId : undefined}
            data-invalid={ariaInvalid ? 'true' : undefined}
            aria-describedby={ariaDescribedBy}
            onClick={() => setOpen((prev) => !prev)}
            className={inputVariants({
              className: 'flex items-center justify-between gap-2 text-left tabular-nums',
            })}
          >
            <span className="truncate">{summaryParts.join(', ')}</span>
            <Users className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden="true" />
          </button>

          <AnchoredPopover
            open={open}
            triggerRef={triggerRef}
            onClose={handleClose}
            minSpaceBelow={260}
            className="p-3"
          >
            <div id={popoverId} className="flex flex-col gap-3">
              <StepperRow
                label={t('search.passengersAdults')}
                hint={t('search.passengersAdultsHint')}
                value={adults}
                disableDecrement={adults <= minAdults}
                disableIncrement={adults >= maxAdults || total >= MAX_PASSENGERS}
                onDecrement={() =>
                  onChange({ adults: Math.max(1, adults - 1), children: childrenCount, infants })
                }
                onIncrement={() =>
                  onChange({ adults: adults + 1, children: childrenCount, infants })
                }
              />
              <StepperRow
                label={t('search.passengersChildren')}
                hint={t('search.passengersChildrenHint')}
                value={childrenCount}
                disableDecrement={childrenCount <= 0}
                disableIncrement={childrenCount >= maxChildren || total >= MAX_PASSENGERS}
                onDecrement={() =>
                  onChange({ adults, children: Math.max(0, childrenCount - 1), infants })
                }
                onIncrement={() => onChange({ adults, children: childrenCount + 1, infants })}
              />
              <StepperRow
                label={t('search.passengersInfants')}
                hint={t('search.passengersInfantsHint')}
                value={infants}
                disableDecrement={infants <= 0}
                disableIncrement={infants >= maxInfants || total >= MAX_PASSENGERS}
                onDecrement={() =>
                  onChange({ adults, children: childrenCount, infants: Math.max(0, infants - 1) })
                }
                onIncrement={() =>
                  onChange({ adults, children: childrenCount, infants: infants + 1 })
                }
              />
              <p className={cn('border-t border-line pt-2 text-xs text-fg-muted')}>
                {t('search.passengersRule')}
              </p>
            </div>
          </AnchoredPopover>
        </div>
      )}
    </Field>
  );
}

interface StepperRowProps {
  label: string;
  hint: string;
  value: number;
  disableDecrement: boolean;
  disableIncrement: boolean;
  onDecrement: () => void;
  onIncrement: () => void;
}

function StepperRow({
  label,
  hint,
  value,
  disableDecrement,
  disableIncrement,
  onDecrement,
  onIncrement,
}: StepperRowProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-fg">{label}</p>
        <p className="text-xs text-fg-muted">{hint}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="icon"
          disabled={disableDecrement}
          aria-label={t('search.decrease', { label })}
          onClick={onDecrement}
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </Button>
        <span className="w-6 text-center text-sm font-semibold text-fg tabular-nums">{value}</span>
        <Button
          variant="secondary"
          size="icon"
          disabled={disableIncrement}
          aria-label={t('search.increase', { label })}
          onClick={onIncrement}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
