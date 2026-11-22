import type {
  Envelope,
  PageMeta,
  Paginated,
  Project,
} from '@/lib/types';
import { baseApi } from './baseApi';

export interface ProjectInput {
  name: string;
  description?: string;
  repositoryUrl?: string;
  defaultBranch?: string;
  primaryLanguage?: string;
}

export interface ProjectListArgs {
  page?: number;
  limit?: number;
}

export const projectsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProjects: builder.query<Paginated<Project>, ProjectListArgs>({
      query: ({ page = 1, limit = 20 }) => ({
        url: '/projects',
        params: { page, limit },
      }),
      transformResponse: (response: Envelope<Project[]> & { meta: PageMeta }) => ({
        data: response.data,
        meta: response.meta,
      }),
      providesTags: ['Project'],
    }),
    getProject: builder.query<Project, string>({
      query: (id) => `/projects/${id}`,
      transformResponse: (response: Envelope<Project>) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'Project', id }],
    }),
    createProject: builder.mutation<Project, ProjectInput>({
      query: (body) => ({ url: '/projects', method: 'POST', body }),
      transformResponse: (response: Envelope<Project>) => response.data,
      invalidatesTags: ['Project'],
    }),
    updateProject: builder.mutation<
      Project,
      { id: string; patch: Partial<ProjectInput> }
    >({
      query: ({ id, patch }) => ({
        url: `/projects/${id}`,
        method: 'PATCH',
        body: patch,
      }),
      transformResponse: (response: Envelope<Project>) => response.data,
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Project', id },
        'Project',
      ],
    }),
    deleteProject: builder.mutation<void, string>({
      query: (id) => ({ url: `/projects/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Project'],
    }),
  }),
});

export const {
  useGetProjectsQuery,
  useGetProjectQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
} = projectsApi;
