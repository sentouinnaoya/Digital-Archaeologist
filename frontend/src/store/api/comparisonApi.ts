import type {
  CommitComparison,
  Envelope,
  SourceFileDiff,
} from '@/lib/types';
import { baseApi } from './baseApi';

export interface HistoricalComparisonArgs {
  projectId: string;
  from: string;
  to: string;
}

export interface HistoricalFileComparisonArgs extends HistoricalComparisonArgs {
  path: string;
}

export const comparisonApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    compareProjectHistory: builder.query<CommitComparison, HistoricalComparisonArgs>({
      query: ({ projectId, from, to }) => ({
        url: `/projects/${projectId}/compare`,
        params: { from, to },
      }),
      transformResponse: (response: Envelope<CommitComparison>) => response.data,
      providesTags: ['HistoricalComparison', 'Commit'],
    }),
    compareProjectHistoryFile: builder.query<SourceFileDiff, HistoricalFileComparisonArgs>({
      query: ({ projectId, from, to, path }) => ({
        url: `/projects/${projectId}/compare/files`,
        params: { from, to, path },
      }),
      transformResponse: (response: Envelope<SourceFileDiff>) => response.data,
      providesTags: ['HistoricalComparison'],
    }),
  }),
});

export const {
  useCompareProjectHistoryQuery,
  useCompareProjectHistoryFileQuery,
} = comparisonApi;
