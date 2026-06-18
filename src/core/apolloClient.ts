import { ApolloClient, InMemoryCache } from '@apollo/client';

import { env } from '@/env';

// Apollo Client for GraphQL server-state (normalized cache, fragments, policies).
export const apolloClient = new ApolloClient({
  uri: env.VITE_GRAPHQL_URL,
  cache: new InMemoryCache(),
});
