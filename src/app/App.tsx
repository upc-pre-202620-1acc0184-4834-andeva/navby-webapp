import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureBoneyard } from 'boneyard-js/react';
import '@/bones/registry';
import { RouterProvider } from 'react-router/dom';
import { isApiError } from '@/shared/api/errors';
import { bindSessionSync } from '@/shared/auth/useSession';
import { AppToaster } from './AppToaster';
import { router } from './router';

// Skeletons con los tokens de DESIGN.md (las variables cambian solas con .dark).
configureBoneyard({
  color: 'var(--color-skeleton)',
  darkColor: 'var(--color-skeleton)',
  animate: 'pulse',
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) =>
        !(isApiError(error) && error.status > 0 && error.status < 500) && failureCount < 1,
    },
  },
});

bindSessionSync(queryClient);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <AppToaster />
    </QueryClientProvider>
  );
}
