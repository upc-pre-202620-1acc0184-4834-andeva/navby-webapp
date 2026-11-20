import { useQuery } from '@tanstack/react-query';
import { getWallet } from '@/shared/api/endpoints';
import { billingKeys } from '../billingKeys';

export const walletKeys = {
  current: billingKeys.wallet,
};

/** Saldo de créditos (US-26). La billetera nace al verificar el correo (RN-17). */
export function useWallet(enabled: boolean) {
  return useQuery({
    queryKey: walletKeys.current,
    queryFn: ({ signal }) => getWallet(signal),
    enabled,
    staleTime: 60_000,
  });
}

/** Hora de recarga gratuita (00:00 Lima) en el formato del idioma. */
export function formatResetTime(resetAtIso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'America/Lima',
  }).format(new Date(resetAtIso));
}
