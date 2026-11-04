import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { PageError, PageLoading, PageNotFound } from "@/components/PageState";

export const getRouter = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: PageLoading,
    defaultPendingMs: 300,
    defaultErrorComponent: PageError,
    defaultNotFoundComponent: PageNotFound,
  });

  return router;
};
