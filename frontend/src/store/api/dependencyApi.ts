import type {
  DependencyCycle,
  DependencyGraph,
  Envelope,
  GraphComparison,
} from '@/lib/types';
import { baseApi } from './baseApi';

export interface DependencyGraphArgs {
  projectId: string;
  commitHash?: string;
}

export interface DependencyCompareArgs {
  projectId: string;
  from: string;
  to: string;
}

export const dependencyApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProjectDependencies: builder.query<DependencyGraph, DependencyGraphArgs>({
      query: ({ projectId, commitHash }) => ({
        url: `/projects/${projectId}/dependencies`,
        params: commitHash ? { commitHash } : undefined,
      }),
      transformResponse: (response: Envelope<DependencyGraph>) => response.data,
      providesTags: ['DependencyGraph', 'SourceAnalysis'],
    }),
    getProjectDependencyCycles: builder.query<DependencyCycle[], DependencyGraphArgs>({
      query: ({ projectId, commitHash }) => ({
        url: `/projects/${projectId}/dependencies/cycles`,
        params: commitHash ? { commitHash } : undefined,
      }),
      transformResponse: (response: Envelope<DependencyCycle[]>) => response.data,
      providesTags: ['DependencyGraph', 'SourceAnalysis'],
    }),
    compareProjectDependencies: builder.query<GraphComparison, DependencyCompareArgs>({
      query: ({ projectId, from, to }) => ({
        url: `/projects/${projectId}/dependencies/compare`,
        params: { from, to },
      }),
      transformResponse: (response: Envelope<GraphComparison>) => response.data,
      providesTags: ['DependencyGraph'],
    }),
  }),
});

export const {
  useGetProjectDependenciesQuery,
  useGetProjectDependencyCyclesQuery,
  useCompareProjectDependenciesQuery,
} = dependencyApi;
