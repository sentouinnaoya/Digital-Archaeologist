import type {
  Envelope,
  Paginated,
  PageMeta,
  ReconstructedStructure,
  TimelineEvent,
  TimelineQueryArgs,
} from '@/lib/types';
import { baseApi } from './baseApi';

export const timelineApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getTimeline: builder.query<Paginated<TimelineEvent>, TimelineQueryArgs>({
      query: ({ projectId, page = 1, limit = 20, type, from, to, contributor }) => ({
        url: `/projects/${projectId}/timeline`,
        params: Object.fromEntries(
          Object.entries({ page, limit, type, from, to, contributor }).filter(
            ([, value]) => value !== undefined && value !== '',
          ),
        ),
      }),
      transformResponse: (
        response: Envelope<TimelineEvent[]> & { meta: PageMeta },
      ) => ({ data: response.data, meta: response.meta }),
      providesTags: ['Timeline'],
    }),
    getTimelineEvent: builder.query<TimelineEvent, { projectId: string; eventId: string }>({
      query: ({ projectId, eventId }) => `/projects/${projectId}/timeline/${eventId}`,
      transformResponse: (response: Envelope<TimelineEvent>) => response.data,
      providesTags: ['Timeline'],
    }),
    getProjectStructure: builder.query<ReconstructedStructure, { projectId: string; at?: string }>({
      query: ({ projectId, at }) => ({
        url: `/projects/${projectId}/structure`,
        params: at ? { at } : undefined,
      }),
      transformResponse: (response: Envelope<ReconstructedStructure>) => response.data,
      providesTags: ['Structure'],
    }),
  }),
});

export const {
  useGetTimelineQuery,
  useGetTimelineEventQuery,
  useGetProjectStructureQuery,
} = timelineApi;
