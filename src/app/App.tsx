import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router/dom';
import { isApiError } from '@/shared/api/errors';
import { bindSessionSync } from '@/shared/auth/useSession';
import { AppToaster } from './AppToaster';
import { router } from './router';

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
