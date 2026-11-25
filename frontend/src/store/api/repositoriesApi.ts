import type {
  AnalysisJob,
  Commit,
  Contributor,
  Envelope,
  Paginated,
  Repository,
  RepositoryStatusResponse,
  SnapshotFile,
} from '@/lib/types';
import { baseApi } from './baseApi';

export interface ImportRepositoryInput {
  projectId: string;
  repositoryUrl: string;
  defaultBranch?: string;
}

export interface ImportSnapshotInput {
  projectId: string;
  file: File;
}

export interface CommitListArgs {
  projectId: string;
  page?: number;
  limit?: number;
}

export const repositoriesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProjectRepositoryStatus: builder.query<RepositoryStatusResponse, string>({
      query: (projectId) => `/repositories/projects/${projectId}/status`,
      transformResponse: (response: Envelope<RepositoryStatusResponse>) => response.data,
      providesTags: ['Repository'],
    }),
    importRepository: builder.mutation<RepositoryStatusResponse, ImportRepositoryInput>({
      query: (body) => ({ url: '/repositories/import', method: 'POST', body }),
      transformResponse: (response: Envelope<RepositoryStatusResponse>) => response.data,
      invalidatesTags: ['Repository', 'Project', 'Commit', 'Timeline', 'Structure'],
    }),
    importSnapshot: builder.mutation<RepositoryStatusResponse, ImportSnapshotInput>({
      query: ({ projectId, file }) => {
        const body = new FormData();
        body.append('file', file);
        return {
          url: `/projects/${projectId}/snapshots/import`,
          method: 'POST',
          body,
        };
      },
      transformResponse: (response: Envelope<RepositoryStatusResponse>) => response.data,
      invalidatesTags: ['Repository', 'Project', 'Commit', 'Timeline', 'Structure'],
    }),
    getProjectFiles: builder.query<SnapshotFile[], string>({
      query: (projectId) => `/repositories/projects/${projectId}/files`,
      transformResponse: (response: Envelope<SnapshotFile[]>) => response.data,
      providesTags: ['Repository'],
    }),
    reanalyzeRepository: builder.mutation<AnalysisJob, string>({
      query: (repositoryId) => ({
        url: `/repositories/${repositoryId}/analyze`,
        method: 'POST',
      }),
      transformResponse: (response: Envelope<AnalysisJob>) => response.data,
      invalidatesTags: ['Repository', 'Commit', 'Timeline', 'Structure'],
    }),
    getProjectCommits: builder.query<Paginated<Commit>, CommitListArgs>({
      query: ({ projectId, page = 1, limit = 20 }) => ({
        url: `/repositories/projects/${projectId}/commits`,
        params: { page, limit },
      }),
      transformResponse: (
        response: Envelope<Commit[]> & { meta: Paginated<Commit>['meta'] },
      ) => ({ data: response.data, meta: response.meta }),
      providesTags: ['Commit'],
    }),
    getProjectBranches: builder.query<string[], string>({
      query: (projectId) => `/repositories/projects/${projectId}/branches`,
      transformResponse: (response: Envelope<string[]>) => response.data,
      providesTags: ['Repository'],
    }),
    getProjectTags: builder.query<string[], string>({
      query: (projectId) => `/repositories/projects/${projectId}/tags`,
      transformResponse: (response: Envelope<string[]>) => response.data,
      providesTags: ['Repository'],
    }),
    getProjectContributors: builder.query<Contributor[], string>({
      query: (projectId) => `/repositories/projects/${projectId}/contributors`,
      transformResponse: (response: Envelope<Contributor[]>) => response.data,
      providesTags: ['Commit'],
    }),
    getRepository: builder.query<Repository, string>({
      query: (repositoryId) => `/repositories/${repositoryId}`,
      transformResponse: (response: Envelope<Repository>) => response.data,
      providesTags: ['Repository'],
    }),
  }),
});

export const {
  useGetProjectRepositoryStatusQuery,
  useImportRepositoryMutation,
  useImportSnapshotMutation,
  useGetProjectFilesQuery,
  useReanalyzeRepositoryMutation,
  useGetProjectCommitsQuery,
  useGetProjectBranchesQuery,
  useGetProjectTagsQuery,
  useGetProjectContributorsQuery,
  useGetRepositoryQuery,
} = repositoriesApi;
