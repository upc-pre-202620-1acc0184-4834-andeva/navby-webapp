import { describe, expect, it } from 'vitest';
import { at, podiumResponse, roundTripOffer, wallet } from '@/test/fixtures/podium';
import { PodiumResponseSchema, WalletSchema } from './schemas';

describe('schemas del podio', () => {
  it('acepta la respuesta del podio y la de ida y vuelta', () => {
    expect(PodiumResponseSchema.parse(podiumResponse()).podium).toHaveLength(3);
    expect(
      PodiumResponseSchema.parse(podiumResponse({ podium: [roundTripOffer] })).podium.at(0)?.legs,
    ).toHaveLength(2);
  });

  it('acepta el podio vacío y rechaza más de 3 ofertas', () => {
    expect(PodiumResponseSchema.safeParse(podiumResponse({ podium: [] })).success).toBe(true);
    const four = podiumResponse();
    four.podium = [...four.podium, at(four.podium, 0)];
    expect(PodiumResponseSchema.safeParse(four).success).toBe(false);
  });

  it('valida el saldo', () => {
    expect(WalletSchema.parse(wallet).total_credits).toBe(50);
  });
});
