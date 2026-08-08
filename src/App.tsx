import { ApolloProvider } from '@apollo/client';
import { QueryClientProvider } from '@tanstack/react-query';
import type { JSX } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { apolloClient } from '@/core/apolloClient';
import { queryClient } from '@/core/queryClient';
import { Home } from '@/features/health';
import { ProjectDetailStub, ProjectsPage } from '@/features/projects';

// Root composition: wires cross-cutting providers + routing.
export function App(): JSX.Element {
  return (
    <ApolloProvider client={apolloClient}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/projects" replace />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectDetailStub />} />
            <Route path="/health" element={<Home />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ApolloProvider>
  );
}
