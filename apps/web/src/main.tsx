import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { App } from './App';
import './index.css';
import { ApiRequestError } from './lib/api-client';
import { AuthProvider } from './lib/auth';

/**
 * Query client defaults, chosen for this product rather than accepted blindly:
 *
 *  - `retry` skips 4xx. Retrying a 400 or a 403 will fail identically three more
 *    times while the user watches a spinner; only transient failures are worth
 *    a second attempt.
 *  - `refetchOnWindowFocus` is off. The data changes when someone uploads a file,
 *    not when a window regains focus, and background refetches make an analyst's
 *    table shift under the cursor.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiRequestError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root is missing from index.html.');

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster
            theme="dark"
            position="bottom-right"
            richColors
            closeButton
            toastOptions={{
              style: {
                background: 'var(--color-overlay)',
                border: '1px solid var(--color-line-strong)',
                color: 'var(--color-fg)',
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
