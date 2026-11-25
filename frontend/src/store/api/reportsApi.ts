import type { Envelope, PageMeta, Paginated, Report } from '@/lib/types';
import { baseApi } from './baseApi';

export interface ReportInput {
  projectId: string;
}

export interface ReportIdInput {
  reportId: string;
}

export const reportsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listReports: builder.query<Paginated<Report>, string>({
      query: (projectId) => `/projects/${projectId}/reports`,
      transformResponse: (response: Envelope<Report[]> & { meta: PageMeta }) => ({
        data: response.data,
        meta: response.meta,
      }),
      providesTags: ['Report'],
    }),
    getReport: builder.query<Report, string>({
      query: (reportId) => `/reports/${reportId}`,
      transformResponse: (response: Envelope<Report>) => response.data,
      providesTags: ['Report'],
    }),
    generateReport: builder.mutation<Report, ReportInput>({
      query: ({ projectId }) => ({
        url: `/projects/${projectId}/reports`,
        method: 'POST',
      }),
      transformResponse: (response: Envelope<Report>) => response.data,
      invalidatesTags: ['Report'],
    }),
    deleteReport: builder.mutation<void, ReportIdInput>({
      query: ({ reportId }) => ({ url: `/reports/${reportId}`, method: 'DELETE' }),
      invalidatesTags: ['Report'],
    }),
  }),
});

export const {
  useListReportsQuery,
  useGetReportQuery,
  useGenerateReportMutation,
  useDeleteReportMutation,
} = reportsApi;
