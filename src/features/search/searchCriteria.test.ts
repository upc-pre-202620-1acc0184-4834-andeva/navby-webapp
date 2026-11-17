import { describe, expect, it } from 'vitest';
import {
  addDaysIso,
  buildSearchParams,
  createSearchCriteriaSchema,
  getTodayInLima,
  isoToUtcDate,
  parseSearchParams,
  type SearchCriteria,
} from './searchCriteria';

const TODAY_LIMA = '2026-11-16';
const schema = createSearchCriteriaSchema(TODAY_LIMA);

const VALID_ROUND_TRIP: SearchCriteria = {
  tripType: 'ROUND_TRIP',
  origins: ['LIM'],
  destinations: ['HND', 'NRT'],
  departureDate: '2026-12-01',
  returnDate: '2026-12-15',
  adults: 2,
  children: 1,
  infants: 1,
  cabin: 'BUSINESS',
  currency: 'PEN',
};

describe('searchCriteria (RN-01..RN-04 & URL state)', () => {
  it('acepta ida y vuelta válido y solo ida con returnDate null', () => {
    expect(schema.safeParse(VALID_ROUND_TRIP).success).toBe(true);
    expect(
      schema.safeParse({
        ...VALID_ROUND_TRIP,
        tripType: 'ONE_WAY',
        returnDate: null,
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        ...VALID_ROUND_TRIP,
        departureDate: TODAY_LIMA,
        returnDate: TODAY_LIMA,
      }).success,
    ).toBe(true);
  });

  it('rechaza aeropuertos repetidos entre origen y destino', () => {
    const result = schema.safeParse({
      ...VALID_ROUND_TRIP,
      origins: ['LIM', 'MIA'],
      destinations: ['MIA', 'JFK'],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'search.errors.sameAirport')).toBe(true);
    }
  });

  it('respeta RN-02: más infantes que adultos y máximo 9 pasajeros', () => {
    const tooManyInfants = schema.safeParse({
      ...VALID_ROUND_TRIP,
      adults: 1,
      children: 0,
      infants: 2,
    });
    expect(tooManyInfants.success).toBe(false);
    if (!tooManyInfants.success) {
      expect(
        tooManyInfants.error.issues.some((i) => i.message === 'search.errors.infantsExceedAdults'),
      ).toBe(true);
    }

    const overNine = schema.safeParse({
      ...VALID_ROUND_TRIP,
      adults: 8,
      children: 2,
      infants: 0,
    });
    expect(overNine.success).toBe(false);
    if (!overNine.success) {
      expect(overNine.error.issues.some((i) => i.message === 'search.errors.maxPassengers')).toBe(
        true,
      );
    }
  });

  it('respeta RN-04: fechas pasadas, retorno anterior a salida y límite de 330 días', () => {
    const pastDep = schema.safeParse({
      ...VALID_ROUND_TRIP,
      departureDate: '2026-11-15',
    });
    expect(pastDep.success).toBe(false);
    if (!pastDep.success) {
      expect(pastDep.error.issues.some((i) => i.message === 'search.errors.departurePast')).toBe(
        true,
      );
    }

    const retBeforeDep = schema.safeParse({
      ...VALID_ROUND_TRIP,
      departureDate: '2026-12-10',
      returnDate: '2026-12-05',
    });
    expect(retBeforeDep.success).toBe(false);
    if (!retBeforeDep.success) {
      expect(
        retBeforeDep.error.issues.some((i) => i.message === 'search.errors.returnBeforeDeparture'),
      ).toBe(true);
    }

    const maxAllowed = addDaysIso(TODAY_LIMA, 330);
    expect(
      schema.safeParse({
        ...VALID_ROUND_TRIP,
        departureDate: maxAllowed,
        returnDate: maxAllowed,
      }).success,
    ).toBe(true);

    const overMax = addDaysIso(TODAY_LIMA, 331);
    const tooFar = schema.safeParse({
      ...VALID_ROUND_TRIP,
      departureDate: '2026-12-01',
      returnDate: overMax,
    });
    expect(tooFar.success).toBe(false);
    if (!tooFar.success) {
      expect(tooFar.error.issues.some((i) => i.message === 'search.errors.dateTooFar')).toBe(true);
    }
  });

  it('calcula getTodayInLima en America/Lima y convierte fechas UTC sin desfase', () => {
    // 2026-11-17T03:30:00Z corresponde a 2026-11-16 22:30 en Lima (UTC-5)
    expect(getTodayInLima(new Date('2026-11-17T03:30:00Z'))).toBe('2026-11-16');
    expect(isoToUtcDate('2026-02-30')).toBeUndefined();
  });

  it('serializa y deserializa ida y vuelta, solo ida y parámetros externos', () => {
    const existing = new URLSearchParams('lang=es&profile=FAST&ret=2026-12-20');
    const serialized = buildSearchParams(VALID_ROUND_TRIP, existing);
    expect(serialized.get('profile')).toBe('FAST');
    expect(serialized.get('from')).toBe('LIM');
    expect(serialized.get('to')).toBe('HND,NRT');

    const parsed = parseSearchParams(serialized);
    expect(parsed.hasSearchQuery).toBe(true);
    expect(parsed.criteria).toEqual(VALID_ROUND_TRIP);

    const oneWayParams = buildSearchParams(
      { ...VALID_ROUND_TRIP, tripType: 'ONE_WAY', returnDate: null },
      serialized,
    );
    expect(oneWayParams.has('ret')).toBe(false);

    // Preserva combinaciones inválidas de URL para que Zod informe el error exacto (US-34).
    const invalidUrl = parseSearchParams(
      new URLSearchParams('trip=ONE_WAY&from=lim&to=mad&dep=2026-12-01&ad=1&ch=0&in=2'),
    );
    expect(invalidUrl.criteria.origins).toEqual(['LIM']);
    expect(invalidUrl.criteria.infants).toBe(2);
    expect(schema.safeParse(invalidUrl.criteria).success).toBe(false);
  });
});
