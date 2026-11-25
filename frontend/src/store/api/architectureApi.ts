import type {
  ArchitectureEvolution,
  ArchitectureSnapshot,
  Envelope,
} from '@/lib/types';
import { baseApi } from './baseApi';

export interface ArchitectureQueryArgs {
  projectId: string;
  commitHash?: string;
}

export interface ArchitectureCompareArgs {
  projectId: string;
  from: string;
  to: string;
}

export const architectureApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProjectArchitecture: builder.query<ArchitectureSnapshot, ArchitectureQueryArgs>({
      query: ({ projectId, commitHash }) => ({
        url: `/projects/${projectId}/architecture`,
        params: commitHash ? { commitHash } : undefined,
      }),
      transformResponse: (response: Envelope<ArchitectureSnapshot>) => response.data,
      providesTags: ['Architecture', 'SourceAnalysis'],
    }),
    compareProjectArchitecture: builder.query<ArchitectureEvolution, ArchitectureCompareArgs>({
      query: ({ projectId, from, to }) => ({
        url: `/projects/${projectId}/architecture/history`,
        params: { from, to },
      }),
      transformResponse: (response: Envelope<ArchitectureEvolution>) => response.data,
      providesTags: ['Architecture'],
    }),
  }),
});

export const {
  useGetProjectArchitectureQuery,
  useCompareProjectArchitectureQuery,
} = architectureApi;
