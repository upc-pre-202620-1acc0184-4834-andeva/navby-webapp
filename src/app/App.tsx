import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureBoneyard } from 'boneyard-js/react';
import { RouterProvider } from 'react-router/dom';
import { AppToaster } from './AppToaster';
import { router } from './router';

// Skeletons con los tokens de DESIGN.md (las variables cambian solas con .dark).
configureBoneyard({
  color: 'var(--color-skeleton)',
  darkColor: 'var(--color-skeleton)',
  animate: 'pulse',
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <AppToaster />
    </QueryClientProvider>
  );
}
