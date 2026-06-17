import { ApolloProvider } from '@apollo/client';
import { QueryClientProvider } from '@tanstack/react-query';
import type { JSX } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { apolloClient } from '@/core/apolloClient';
import { queryClient } from '@/core/queryClient';
import { Home } from '@/routes/Home';

// Root composition: wires cross-cutting providers + routing.
export function App(): JSX.Element {
  return (
    <ApolloProvider client={apolloClient}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ApolloProvider>
  );
}
