import { type QueryClient, useQuery } from '@tanstack/react-query';
import { registerSessionListener } from '@/shared/api/client';
import { bootstrapSession } from '@/shared/api/endpoints';
import { type UserSummary } from '@/shared/api/schemas';

export const sessionKeys = {
  current: ['session'] as const,
  profile: ['users', 'me'] as const,
};

/**
 * Conecta las rotaciones o expiraciones de `client.ts` con la caché de TanStack Query
 * al instanciar el QueryClient (evitando efectos en React bajo StrictMode).
 */
export function bindSessionSync(queryClient: QueryClient): () => void {
  return registerSessionListener((user) => {
    queryClient.setQueryData<UserSummary | null>(sessionKeys.current, user);
    if (user === null) {
      queryClient.removeQueries({ queryKey: sessionKeys.profile });
    }
  });
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
