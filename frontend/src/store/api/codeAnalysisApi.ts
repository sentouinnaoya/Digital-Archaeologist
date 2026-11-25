import type { Envelope, SourceAnalysis } from '@/lib/types';
import { baseApi } from './baseApi';

export interface AnalyzeSourceInput {
  repositoryId: string;
  commitHash?: string;
  refresh?: boolean;
}

export const codeAnalysisApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    analyzeSource: builder.mutation<SourceAnalysis, AnalyzeSourceInput>({
      query: ({ repositoryId, commitHash, refresh }) => ({
        url: `/code-analysis/repositories/${repositoryId}/analyze`,
        method: 'POST',
        body: {
          ...(commitHash ? { commitHash } : {}),
          ...(refresh ? { refresh } : {}),
        },
      }),
      transformResponse: (response: Envelope<SourceAnalysis>) => response.data,
      invalidatesTags: ['SourceAnalysis'],
    }),
    getProjectSourceAnalysis: builder.query<SourceAnalysis, string>({
      query: (projectId) => `/code-analysis/projects/${projectId}/latest`,
      transformResponse: (response: Envelope<SourceAnalysis>) => response.data,
      providesTags: ['SourceAnalysis'],
    }),
  }),
});

export const {
  useAnalyzeSourceMutation,
  useGetProjectSourceAnalysisQuery,
} = codeAnalysisApi;
