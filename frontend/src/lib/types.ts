export interface PublicUser {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
}

export type ProjectAnalysisStatus =
  | 'not_started'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed';

export interface Project {
  id: string;
  name: string;
  description: string;
  repositoryUrl: string | null;
  defaultBranch: string;
  primaryLanguage: string | null;
  analysisStatus: ProjectAnalysisStatus;
  lastAnalyzedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RepositoryStatus = 'importing' | 'ready' | 'failed';

export interface LicenseDetection {
  identifier: string;
  confidence: 'detected' | 'likely' | 'unknown';
  path: string | null;
}

export interface Repository {
  id: string;
  projectId: string;
  sourceType: 'git_url';
  repositoryUrl: string;
  defaultBranch: string;
  status: RepositoryStatus;
  license: LicenseDetection | null;
  branches: string[];
  tags: string[];
  headCommitHash: string | null;
  totalCommitCount: number;
  analyzedCommitCount: number;
  detectedLanguages: string[];
  lastImportedAt: string | null;
  lastAnalyzedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

export interface AnalysisJob {
  id: string;
  repositoryId: string;
  projectId: string;
  type: 'import' | 'reanalyze';
  status: ProjectAnalysisStatus;
  progress: number;
  currentStep: string;
  error: string | null;
  steps: JobStep[];
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface RepositoryStatusResponse {
  repository: Repository | null;
  job: AnalysisJob | null;
}

export interface CommitFileChange {
  status: string;
  path: string;
}

export interface Commit {
  id: string;
  hash: string;
  message: string;
  authorName: string;
  authorEmail: string;
  authoredAt: string;
  committedAt: string;
  parentHashes: string[];
  fileChanges: CommitFileChange[];
}

export interface Contributor {
  email: string;
  name: string;
  commitCount: number;
  firstCommitAt: string;
  lastCommitAt: string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export interface Envelope<T> {
  data: T;
  meta?: PageMeta;
}

export function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = (error as { data?: { message?: string | string[] } }).data;
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(', ') : data.message;
    }
  }
  return 'Something went wrong. Please try again.';
}
