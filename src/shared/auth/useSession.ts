import { type QueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { registerSessionListener } from '@/shared/api/client';
import { bootstrapSession, logout } from '@/shared/api/endpoints';
import { type UserSummary } from '@/shared/api/schemas';
import { clearLastSearch } from '@/shared/search/lastSearch';

export const sessionKeys = {
  current: ['session'] as const,
  profile: ['users', 'me'] as const,
};

const PENDING_ORDER_STORAGE_KEY = 'navby:pending_order_id';

function clearPendingOrderStorage(): void {
  try {
    sessionStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
  } catch {
    // sessionStorage puede no estar disponible en entornos restringidos.
  }
}

/** Marca el correo como no verificado en la caché para que `RequireAuth` redirija a `/verify-email`. */
export function markEmailUnverified(queryClient: QueryClient): void {
  queryClient.setQueryData<UserSummary | null>(sessionKeys.current, (user) =>
    user ? { ...user, email_verified: false } : user,
  );
}

/**
 * Conecta las rotaciones o expiraciones de `client.ts` con la caché de TanStack Query
 * al instanciar el QueryClient (evitando efectos en React bajo StrictMode).
 * Al cerrar sesión o cambiar de usuario borra toda caché que no sea la sesión.
 */
export function bindSessionSync(queryClient: QueryClient): () => void {
  let lastUserId: string | null = null;
  const notSession = (query: { queryKey: readonly unknown[] }) => query.queryKey[0] !== 'session';
  return registerSessionListener((user) => {
    queryClient.setQueryData<UserSummary | null>(sessionKeys.current, user);
    if (user === null) {
      // Solo las inactivas: borrar una query montada la vuelve a pedir y reabriría la sesión.
      // Las que siguen montadas se desmontan con RequireAuth y caen en el cambio de usuario.
      queryClient.removeQueries({ predicate: notSession, type: 'inactive' });
      clearPendingOrderStorage();
      clearLastSearch();
    } else if (lastUserId !== null && lastUserId !== user.user_id) {
      queryClient.removeQueries({ predicate: notSession });
      clearPendingOrderStorage();
      clearLastSearch();
    }
    if (user) lastUserId = user.user_id;
  });
}

/** Cierre de sesión compartido por TopBar y /account; RequireAuth lleva a /login. */
export function useLogout() {
  return useMutation({ mutationFn: logout });
}

export function useSession() {
  const query = useQuery({
    queryKey: sessionKeys.current,
    queryFn: bootstrapSession,
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const user = query.data ?? null;

  return {
    user,
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    isAuthenticated: user !== null,
  };
}
