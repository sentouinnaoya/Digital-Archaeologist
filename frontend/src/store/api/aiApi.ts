import type {
  AiChatResult,
  AiConversationSummary,
  AiStatus,
  Envelope,
  PageMeta,
  Paginated,
} from '@/lib/types';
import { baseApi } from './baseApi';

export interface AiChatInput {
  projectId: string;
  message: string;
  conversationId?: string;
  consent: boolean;
}

export interface AiConversationInput {
  conversationId: string;
}

export const aiApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAiStatus: builder.query<AiStatus, string>({
      query: (projectId) => `/projects/${projectId}/ai/status`,
      transformResponse: (response: Envelope<AiStatus>) => response.data,
      providesTags: ['AiConversation'],
    }),
    listAiConversations: builder.query<Paginated<AiConversationSummary>, string>({
      query: (projectId) => `/projects/${projectId}/ai/conversations`,
      transformResponse: (
        response: Envelope<AiConversationSummary[]> & { meta: PageMeta },
      ) => ({ data: response.data, meta: response.meta }),
      providesTags: ['AiConversation'],
    }),
    getAiConversation: builder.query<AiConversationSummary, string>({
      query: (conversationId) => `/ai/conversations/${conversationId}`,
      transformResponse: (response: Envelope<AiConversationSummary>) => response.data,
      providesTags: ['AiConversation'],
    }),
    sendAiMessage: builder.mutation<AiChatResult, AiChatInput>({
      query: ({ projectId, ...body }) => ({
        url: `/projects/${projectId}/ai/chat`,
        method: 'POST',
        body,
      }),
      transformResponse: (response: Envelope<AiChatResult>) => response.data,
      invalidatesTags: ['AiConversation'],
    }),
    deleteAiConversation: builder.mutation<void, AiConversationInput>({
      query: ({ conversationId }) => ({
        url: `/ai/conversations/${conversationId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['AiConversation'],
    }),
  }),
});

export const {
  useGetAiStatusQuery,
  useListAiConversationsQuery,
  useGetAiConversationQuery,
  useSendAiMessageMutation,
  useDeleteAiConversationMutation,
} = aiApi;
