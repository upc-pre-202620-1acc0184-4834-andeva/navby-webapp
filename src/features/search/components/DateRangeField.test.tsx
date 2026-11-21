import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { addDaysIso, getTodayInLima } from '../searchCriteria';
import { DateRangeField } from './DateRangeField';

function ControlledDateRange({
  initialDep = '',
  initialRet = '',
  onChangeSpy,
}: {
  initialDep?: string;
  initialRet?: string | null;
  onChangeSpy: (dates: { departureDate: string; returnDate: string | null }) => void;
}) {
  const [dates, setDates] = useState<{ departureDate: string; returnDate: string | null }>({
    departureDate: initialDep,
    returnDate: initialRet,
  });

  return (
    <DateRangeField
      tripType="ROUND_TRIP"
      departureDate={dates.departureDate}
      returnDate={dates.returnDate}
      todayLima={getTodayInLima()}
      onDatesChange={(next) => {
        setDates(next);
        onChangeSpy(next);
      }}
    />
  );
}

describe('DateRangeField', () => {
  it('permite elegir rango por clic y mantiene Regreso abierto tras seleccionar Salida', async () => {
    const onDatesChange = vi.fn();
    const user = userEvent.setup();

    render(<ControlledDateRange onChangeSpy={onDatesChange} />);

    await user.click(screen.getByRole('button', { name: 'Salida' }));
    const enabled = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-day-iso]:not([disabled])'),
    );
    expect(enabled.length).toBeGreaterThan(4);

    await user.click(enabled[0]!);
    expect(onDatesChange).toHaveBeenCalledWith({
      departureDate: enabled[0]!.dataset.dayIso,
      returnDate: '',
    });

    // Al pulsar Regreso cuando ya estaba seleccionando regreso, el calendario sigue abierto.
    await user.click(screen.getByRole('button', { name: 'Regreso' }));
    expect(screen.getByRole('region', { name: 'Calendario de fechas de viaje' })).toBeVisible();

    await user.click(enabled[3]!);
    expect(onDatesChange).toHaveBeenLastCalledWith({
      departureDate: enabled[0]!.dataset.dayIso,
      returnDate: enabled[3]!.dataset.dayIso,
    });
  });

  it('permite arrastrar un rango nuevo y mover los puntos extremos del rango existente', async () => {
    const today = getTodayInLima();
    const dep = addDaysIso(today, 2);
    const ret = addDaysIso(today, 5);
    const onDatesChange = vi.fn();
    const user = userEvent.setup();

    render(<ControlledDateRange initialDep={dep} initialRet={ret} onChangeSpy={onDatesChange} />);

    await user.click(screen.getByRole('button', { name: 'Salida' }));

    const startBtn = document.querySelector<HTMLButtonElement>(`[data-day-iso="${dep}"]`)!;
    const endBtn = document.querySelector<HTMLButtonElement>(`[data-day-iso="${ret}"]`)!;
    expect(startBtn.dataset.endpoint).toBe('start');
    expect(endBtn.dataset.endpoint).toBe('end');

    const newEndIso = addDaysIso(today, 7);
    const newEndBtn = document.querySelector<HTMLButtonElement>(`[data-day-iso="${newEndIso}"]`)!;
    const origElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = vi.fn(() => newEndBtn);

    try {
      fireEvent.pointerDown(endBtn, { button: 0, clientX: 100, clientY: 100 });
      fireEvent.pointerMove(window, { clientX: 160, clientY: 100 });
      fireEvent.pointerUp(window, { clientX: 160, clientY: 100 });
    } finally {
      document.elementFromPoint = origElementFromPoint;
    }

    expect(onDatesChange).toHaveBeenCalledWith({
      departureDate: dep,
      returnDate: newEndIso,
    });
    // Tras arrastrar un extremo, el calendario permanece abierto para ajustar el otro punto o pulsar Listo.
    expect(screen.getByRole('region', { name: 'Calendario de fechas de viaje' })).toBeVisible();
  });
});
