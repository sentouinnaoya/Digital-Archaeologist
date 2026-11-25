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
  sourceType: 'git_url' | 'zip';
  repositoryUrl: string | null;
  snapshotName: string | null;
  defaultBranch: string;
  status: RepositoryStatus;
  license: LicenseDetection | null;
  branches: string[];
  tags: string[];
  headCommitHash: string | null;
  totalCommitCount: number;
  analyzedCommitCount: number;
  detectedLanguages: string[];
  snapshotFileCount: number;
  snapshotTotalBytes: number;
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

export interface SnapshotFile {
  path: string;
  size: number;
  extension: string | null;
  language: string | null;
}

export type TimelineEventType =
  | 'commit'
  | 'file_added'
  | 'file_modified'
  | 'file_deleted'
  | 'file_renamed'
  | 'snapshot';

export type TimelineConfidence = 'detected' | 'likely' | 'possible' | 'unknown';

export interface TimelineEvidence {
  kind: 'commit' | 'file' | 'structure';
  commitHash: string | null;
  path: string | null;
  detail: string;
}

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  occurredAt: string;
  title: string;
  description: string;
  confidence: TimelineConfidence;
  commitHash: string | null;
  contributorEmail: string | null;
  contributorName: string | null;
  paths: string[];
  evidence: TimelineEvidence[];
}

export interface TimelineQueryArgs {
  projectId: string;
  page?: number;
  limit?: number;
  type?: TimelineEventType;
  from?: string;
  to?: string;
  contributor?: string;
}

export interface StructureNode {
  path: string;
  name: string;
  type: 'directory' | 'file';
  lastObservedCommitHash: string | null;
  lastObservedStatus: string | null;
  children: StructureNode[];
}

export interface ReconstructedStructure {
  repositoryId: string;
  atCommitHash: string;
  analyzedCommitCount: number;
  fileCount: number;
  confidence: TimelineConfidence;
  basis: string;
  root: StructureNode;
}

export type SourceFileStatus = 'parsed' | 'syntax_error' | 'unsupported' | 'parse_failed';

export type SourceParserKind =
  | 'tree-sitter-javascript'
  | 'tree-sitter-typescript'
  | 'tree-sitter-tsx'
  | 'tree-sitter-java'
  | 'unsupported';

export interface SourceSymbol {
  name: string;
  kind: string;
  startLine: number;
  endLine: number;
}

export interface SourceImport {
  source: string;
  kind: 'static' | 'commonjs' | 'dynamic' | 'java';
  names: string[];
  line: number;
}

export interface SourceModule {
  name: string;
  kind: 'relative' | 'package' | 'namespace';
  path: string | null;
}

export interface SourceSyntaxError {
  message: string;
  line: number;
  column: number;
}

export interface ParsedSourceFile {
  path: string;
  language: string | null;
  parser: SourceParserKind;
  status: SourceFileStatus;
  size: number;
  symbols: SourceSymbol[];
  imports: SourceImport[];
  modules: SourceModule[];
  syntaxErrors: SourceSyntaxError[];
  truncated: boolean;
}

export interface SourceAnalysisSummary {
  fileCount: number;
  parsedCount: number;
  syntaxErrorCount: number;
  unsupportedCount: number;
  failedCount: number;
  symbolCount: number;
  importCount: number;
  fileLimitApplied: boolean;
}

export interface SourceAnalysis {
  id: string;
  repositoryId: string;
  projectId: string;
  sourceType: 'git_url' | 'zip';
  commitHash: string;
  analyzerVersion: string;
  cached: boolean;
  files: ParsedSourceFile[];
  summary: SourceAnalysisSummary;
  createdAt: string;
  updatedAt: string;
}

export type DependencyNodeKind = 'file' | 'package' | 'unresolved';

export interface NodeMetrics {
  fanIn: number;
  fanOut: number;
  coupling: number;
  instability: number;
}

export interface DependencyNode {
  id: string;
  kind: DependencyNodeKind;
  label: string;
  path: string | null;
  language: string | null;
  parser: string | null;
  status: SourceFileStatus | null;
  metrics: NodeMetrics;
}

export type DependencyEdgeKind = 'relative' | 'package' | 'java' | 'unresolved';

export interface GraphEvidence {
  path: string;
  line: number;
  importSource: string;
  detail: string;
}

export interface DependencyEdge {
  id: string;
  source: string;
  target: string;
  kind: DependencyEdgeKind;
  evidence: GraphEvidence[];
}

export interface DependencyCycle {
  id: string;
  nodes: string[];
  edges: string[];
  evidence: GraphEvidence[];
}

export interface GraphMetrics {
  nodeCount: number;
  fileCount: number;
  packageCount: number;
  unresolvedCount: number;
  edgeCount: number;
  cycleCount: number;
  averageCoupling: number;
  maxFanIn: number;
  maxFanOut: number;
}

export interface DependencyGraph {
  repositoryId: string;
  projectId: string;
  commitHash: string;
  analyzerVersion: string;
  sourceType: 'git_url' | 'zip';
  basis: string;
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  cycles: DependencyCycle[];
  metrics: GraphMetrics;
}

export interface GraphComparison {
  fromCommitHash: string;
  toCommitHash: string;
  basis: string;
  addedNodes: DependencyNode[];
  removedNodes: DependencyNode[];
  addedEdges: DependencyEdge[];
  removedEdges: DependencyEdge[];
  couplingChanges: Array<{
    nodeId: string;
    before: NodeMetrics;
    after: NodeMetrics;
    couplingDelta: number;
  }>;
}

export type ArchitectureConfidence = 'detected' | 'likely' | 'possible' | 'unknown';

export type ArchitectureClaimType =
  | 'module_boundary'
  | 'layering'
  | 'framework_usage'
  | 'entry_point_candidate'
  | 'deployment_config'
  | 'service_naming'
  | 'microservice_inference';

export interface ArchitectureEvidence {
  kind: 'file' | 'import' | 'symbol' | 'structure';
  path: string;
  line: number | null;
  detail: string;
}

export interface ArchitectureModule {
  id: string;
  name: string;
  kind: 'directory' | 'java_package';
  filePaths: string[];
  fileCount: number;
  symbolCount: number;
  internalEdgeCount: number;
  externalEdgeCount: number;
  imports: string[];
  importedBy: string[];
  confidence: ArchitectureConfidence;
}

export interface ArchitectureDirectionality {
  sourceModuleIds: string[];
  sinkModuleIds: string[];
  crossModuleEdgeCount: number;
  hasModuleCycle: boolean;
  confidence: ArchitectureConfidence;
}

export interface ArchitectureClaim {
  id: string;
  type: ArchitectureClaimType;
  title: string;
  statement: string;
  confidence: ArchitectureConfidence;
  rule: string;
  evidence: ArchitectureEvidence[];
}

export interface ArchitectureMetrics {
  moduleCount: number;
  internalEdgeCount: number;
  crossModuleEdgeCount: number;
  claimCount: number;
  detectedCount: number;
  likelyCount: number;
  possibleCount: number;
  unknownCount: number;
  frameworkCount: number;
  entryPointCount: number;
  deploymentConfigCount: number;
  serviceNamingCount: number;
  networkPackageCount: number;
}

export interface ArchitectureSnapshot {
  repositoryId: string;
  projectId: string;
  commitHash: string;
  analyzerVersion: string;
  sourceType: 'git_url' | 'zip';
  basis: string;
  modules: ArchitectureModule[];
  directionality: ArchitectureDirectionality;
  claims: ArchitectureClaim[];
  metrics: ArchitectureMetrics;
  limits: string[];
}

export interface ArchitectureEvolution {
  fromCommitHash: string;
  toCommitHash: string;
  basis: string;
  addedModules: ArchitectureModule[];
  removedModules: ArchitectureModule[];
  addedClaims: ArchitectureClaim[];
  removedClaims: ArchitectureClaim[];
  confidenceChanges: Array<{
    id: string;
    before: ArchitectureConfidence;
    after: ArchitectureConfidence;
  }>;
}

export interface ComparisonCommit {
  hash: string;
  message: string;
  authorName: string;
  authorEmail: string;
  authoredAt: string;
  committedAt: string;
  parentHashes: string[];
  fileChanges: CommitFileChange[];
}

export interface StructureDiff {
  addedPaths: string[];
  removedPaths: string[];
  retainedPathCount: number;
  basis: string;
}

export interface SymbolChange {
  path: string;
  name: string;
  kind: string;
  line: number;
}

export interface SymbolDiff {
  added: SymbolChange[];
  removed: SymbolChange[];
  basis: string;
}

export interface CommitComparison {
  fromCommitHash: string;
  toCommitHash: string;
  basis: string;
  from: ComparisonCommit;
  to: ComparisonCommit;
  fileChanges: CommitFileChange[];
  structure: StructureDiff;
  symbols: SymbolDiff | null;
  dependencies: GraphComparison | null;
  limits: string[];
}

export type SourceDiffRowKind = 'context' | 'added' | 'removed' | 'changed';

export interface SourceDiffRow {
  kind: SourceDiffRowKind;
  leftLine: number | null;
  rightLine: number | null;
  left: string | null;
  right: string | null;
}

export interface SourceFileDiff {
  path: string;
  fromCommitHash: string;
  toCommitHash: string;
  basis: string;
  fromExists: boolean;
  toExists: boolean;
  rows: SourceDiffRow[];
  truncated: boolean;
  limits: string[];
}

export type AiEvidenceKind =
  | 'project'
  | 'repository'
  | 'timeline'
  | 'analysis'
  | 'dependency'
  | 'architecture';

export interface AiEvidenceItem {
  id: string;
  kind: AiEvidenceKind;
  source: string;
  detail: string;
  path: string | null;
  commitHash: string | null;
}

export interface AiStatus {
  enabled: boolean;
  model: string;
  basis: string;
  limits: string[];
}

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
  evidenceIds: string[];
  createdAt: string;
}

export interface AiConversationSummary {
  id: string;
  projectId: string;
  title: string;
  model: string;
  basis: string;
  createdAt: string;
  updatedAt: string;
  messages: AiMessage[];
}

export interface AiChatResult {
  conversationId: string;
  answer: string;
  evidence: AiEvidenceItem[];
  basis: string;
  limits: string[];
  model: string;
}

export interface Report {
  id: string;
  projectId: string;
  title: string;
  format: string;
  content: string;
  basis: string;
  evidenceIds: string[];
  limits: string[];
  createdAt: string;
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
