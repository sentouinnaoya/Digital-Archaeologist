import { posix } from 'node:path';
import {
  buildDependencyGraph,
  type GraphSourceFile,
} from '../dependency-analysis/dependency-graph.builder';

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

export interface ArchitectureInput {
  repositoryId: string;
  projectId: string;
  commitHash: string;
  analyzerVersion: string;
  sourceType: 'git_url' | 'zip';
  files: GraphSourceFile[];
  fileLimitApplied: boolean;
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

interface ModuleRef {
  id: string;
  name: string;
  kind: ArchitectureModule['kind'];
}

interface Signal {
  name: string;
  evidence: ArchitectureEvidence[];
}

const FRAMEWORKS: Array<{ id: string; label: string; matches: (source: string) => boolean }> = [
  { id: 'react', label: 'React', matches: (s) => s === 'react' || s.startsWith('react/') },
  { id: 'nestjs', label: 'NestJS', matches: (s) => s.startsWith('@nestjs/') },
  { id: 'express', label: 'Express', matches: (s) => s === 'express' },
  { id: 'spring', label: 'Spring', matches: (s) => s.startsWith('org.springframework') },
  {
    id: 'test',
    label: 'a test framework',
    matches: (s) => ['jest', 'vitest', 'mocha', 'supertest', 'chai'].some((name) => s === name || s.startsWith(`${name}/`)) || s.startsWith('@jest/'),
  },
  { id: 'xyflow', label: 'XYFlow / React Flow', matches: (s) => s.startsWith('@xyflow/') },
];

const NETWORK_PACKAGES = [
  'axios', 'fetch', 'got', 'request', 'superagent', 'ws', 'socket.io', 'grpc',
  '@grpc/', 'kafka', 'amqplib', 'nats', 'node-fetch', 'undici', 'http', 'https',
];

export function buildArchitectureSnapshot(input: ArchitectureInput): ArchitectureSnapshot {
  const files = [...input.files].sort((left, right) => left.path.localeCompare(right.path));
  const fileModules = new Map<string, ModuleRef>();
  const modules = new Map<string, ArchitectureModule>();

  for (const file of files) {
    const ref = moduleForFile(file);
    fileModules.set(file.path, ref);
    const existing = modules.get(ref.id);
    if (existing) {
      existing.filePaths.push(file.path);
      existing.fileCount += 1;
      existing.symbolCount += file.symbols.length;
      continue;
    }
    modules.set(ref.id, {
      id: ref.id,
      name: ref.name,
      kind: ref.kind,
      filePaths: [file.path],
      fileCount: 1,
      symbolCount: file.symbols.length,
      internalEdgeCount: 0,
      externalEdgeCount: 0,
      imports: [],
      importedBy: [],
      confidence: 'detected',
    });
  }

  const graph = buildDependencyGraph({
    repositoryId: input.repositoryId,
    projectId: input.projectId,
    commitHash: input.commitHash,
    analyzerVersion: input.analyzerVersion,
    sourceType: input.sourceType,
    files,
  });

  const moduleEdges: Array<{ source: string; target: string }> = [];
  let internalEdgeCount = 0;
  let crossModuleEdgeCount = 0;

  for (const edge of graph.edges) {
    const sourcePath = edge.evidence[0]?.path ?? edge.source.slice(5);
    const sourceModule = fileModules.get(sourcePath)?.id;
    if (!sourceModule) continue;

    if (edge.kind === 'relative' || edge.kind === 'java') {
      const targetPath = edge.target.startsWith('file:') ? edge.target.slice(5) : null;
      const targetModule = targetPath ? fileModules.get(targetPath)?.id : null;
      if (targetModule) {
        if (targetModule === sourceModule) {
          internalEdgeCount += 1;
          modules.get(sourceModule)!.internalEdgeCount += 1;
        } else {
          crossModuleEdgeCount += 1;
          modules.get(sourceModule)!.externalEdgeCount += 1;
          modules.get(targetModule)!.externalEdgeCount += 1;
          addUnique(modules.get(sourceModule)!.imports, targetModule);
          addUnique(modules.get(targetModule)!.importedBy, sourceModule);
          moduleEdges.push({ source: sourceModule, target: targetModule });
        }
      }
      continue;
    }

    const packageName = edge.target.replace(/^(package|unresolved):/, '');
    addUnique(modules.get(sourceModule)!.imports, `${edge.kind}:${packageName}`);
  }

  const moduleIds = [...modules.keys()].sort();
  const incoming = new Set<string>();
  const outgoing = new Set<string>();
  for (const edge of moduleEdges) {
    outgoing.add(edge.source);
    incoming.add(edge.target);
  }
  const sourceModuleIds = moduleIds.filter((id) => outgoing.has(id) && !incoming.has(id));
  const sinkModuleIds = moduleIds.filter((id) => incoming.has(id) && !outgoing.has(id));
  const hasModuleCycle = detectModuleCycle(moduleEdges);
  const directionality: ArchitectureDirectionality = {
    sourceModuleIds,
    sinkModuleIds,
    crossModuleEdgeCount,
    hasModuleCycle,
    confidence:
      crossModuleEdgeCount === 0
        ? 'unknown'
        : hasModuleCycle
          ? 'possible'
          : crossModuleEdgeCount >= 2 && moduleIds.length >= 3
            ? 'likely'
            : 'possible',
  };

  const claims: ArchitectureClaim[] = [];

  for (const module of modules.values()) {
    const evidence: ArchitectureEvidence[] = module.filePaths.slice(0, 5).map((path) => ({
      kind: 'file',
      path,
      line: null,
      detail: `Analysed file assigned to ${module.name} from its stored path`,
    }));
    const internalEvidence = graph.edges
      .filter((edge) => {
        const sourcePath = edge.evidence[0]?.path ?? edge.source.slice(5);
        const targetPath = edge.target.startsWith('file:') ? edge.target.slice(5) : null;
        return (
          (edge.kind === 'relative' || edge.kind === 'java') &&
          fileModules.get(sourcePath)?.id === module.id &&
          targetPath &&
          fileModules.get(targetPath)?.id === module.id
        );
      })
      .slice(0, 5)
      .flatMap((edge) =>
        edge.evidence.slice(0, 2).map((item) => ({
          kind: 'import' as const,
          path: item.path,
          line: item.line,
          detail: `Internal import ${item.importSource}: ${item.detail}`,
        })),
      );
    evidence.push(...internalEvidence);
    const confidence: ArchitectureConfidence =
      module.internalEdgeCount > 0 && module.externalEdgeCount > 0
        ? 'likely'
        : module.internalEdgeCount > 0 || module.fileCount >= 2
          ? 'possible'
          : 'unknown';
    claims.push({
      id: module.id.startsWith('module:') ? module.id : `module:${module.id}`,
      type: 'module_boundary',
      title: `${module.name} boundary candidate`,
      statement: `${module.name} contains ${module.fileCount} analysed file(s), ${module.symbolCount} symbol(s), ${module.internalEdgeCount} internal import edge(s) and ${module.externalEdgeCount} cross-boundary import edge(s). This is a candidate boundary from stored paths and imports, not a declared architectural module.`,
      confidence,
      rule: 'directory-or-java-package membership with observed import edges',
      evidence,
    });
  }

  if (directionality.crossModuleEdgeCount > 0) {
    const examples = moduleEdges.slice(0, 5).map((edge) => ({
      kind: 'structure' as const,
      path: `${edge.source} → ${edge.target}`,
      line: null,
      detail: 'Cross-module import edge derived from a stored source import',
    }));
    claims.push({
      id: 'layering:observed-direction',
      type: 'layering',
      title: 'Observed cross-module import direction',
      statement: directionality.hasModuleCycle
        ? `Cross-module imports were observed in both directions forming a cycle; no layer order is claimed.`
        : `Cross-module imports run from ${sourceModuleIds.length} source module(s) toward ${sinkModuleIds.length} sink module(s). This is an observed direction, not a named architectural layer.`,
      confidence: directionality.confidence,
      rule: 'cross-module edge direction with cycle check',
      evidence: examples,
    });
  }

  const packageImports = graph.edges
    .filter((edge) => edge.kind === 'package')
    .flatMap((edge) =>
      edge.evidence.map((item) => ({
        source: item.importSource,
        path: item.path,
        line: item.line,
      })),
    );
  const frameworks: Signal[] = [];
  for (const framework of FRAMEWORKS) {
    const matches = packageImports.filter((item) => framework.matches(item.source));
    if (matches.length === 0) continue;
    frameworks.push({
      name: framework.label,
      evidence: matches.slice(0, 5).map((item) => ({
        kind: 'import',
        path: item.path,
        line: item.line,
        detail: `Imported package specifier ${item.source}`,
      })),
    });
    claims.push({
      id: `framework:${framework.id}`,
      type: 'framework_usage',
      title: `${framework.label} import observed`,
      statement: `${framework.label} is imported from ${new Set(matches.map((item) => item.path)).size} analysed file(s). Only the import is claimed, not a broader architectural role.`,
      confidence: 'detected',
      rule: 'external package specifier observed in stored imports',
      evidence: frameworks[frameworks.length - 1].evidence,
    });
  }

  const networkImports = packageImports.filter((item) =>
    NETWORK_PACKAGES.some((name) =>
      name.endsWith('/') ? item.source.startsWith(name) : item.source === name,
    ),
  );

  const entryPoints: Signal[] = [];
  for (const file of files) {
    const base = posix.basename(file.path);
    const isEntry =
      ['main.ts', 'main.js', 'index.ts', 'index.js', 'app.ts', 'server.ts', 'Main.java'].includes(base) ||
      /Application\.java$/.test(base);
    if (!isEntry) continue;
    const moduleId = fileModules.get(file.path)!.id;
    const outgoingCount = moduleEdges.filter((edge) => edge.source === moduleId).length;
    entryPoints.push({
      name: file.path,
      evidence: [
        {
          kind: 'file',
          path: file.path,
          line: null,
          detail: `Filename matches an entry-point convention; ${outgoingCount} cross-module edge(s) from ${moduleId}`,
        },
      ],
    });
    claims.push({
      id: `entry:${file.path}`,
      type: 'entry_point_candidate',
      title: `Entry-point candidate ${file.path}`,
      statement: `${file.path} matches an entry-point filename convention. It is a candidate only; no runtime entry point is verified from stored source evidence.`,
      confidence: outgoingCount >= 2 ? 'likely' : 'possible',
      rule: 'filename convention with optional cross-module import support',
      evidence: entryPoints[entryPoints.length - 1].evidence,
    });
  }

  const deploymentConfigs: Signal[] = [];
  for (const file of files) {
    if (!isDeploymentConfig(file.path)) continue;
    const signal = {
      name: file.path,
      evidence: [
        {
          kind: 'file' as const,
          path: file.path,
          line: null,
          detail: 'Stored path matches a deployment/configuration convention',
        },
      ],
    };
    deploymentConfigs.push(signal);
    claims.push({
      id: `deployment:${file.path}`,
      type: 'deployment_config',
      title: `Deployment configuration path ${file.path}`,
      statement: `${file.path} matches a deployment/configuration path convention. Its presence does not establish deployed topology or service ownership.`,
      confidence: 'detected',
      rule: 'known deployment/configuration path pattern',
      evidence: signal.evidence,
    });
  }

  const serviceSymbols = files.flatMap((file) =>
    file.symbols
      .filter((symbol) => /(Service|Controller|Repository)$/.test(symbol.name))
      .map((symbol) => ({
        path: file.path,
        line: symbol.startLine,
        name: symbol.name,
      })),
  );
  if (serviceSymbols.length > 0) {
    claims.push({
      id: 'service-naming',
      type: 'service_naming',
      title: 'Service-named symbols observed',
      statement: `${serviceSymbols.length} symbol(s) use service/controller/repository naming. Names alone are not evidence of microservices or of any module boundary.`,
      confidence: 'possible',
      rule: 'symbol-name suffix convention',
      evidence: serviceSymbols.slice(0, 8).map((symbol) => ({
        kind: 'symbol' as const,
        path: symbol.path,
        line: symbol.line,
        detail: `Symbol ${symbol.name}`,
      })),
    });
  }

  const distinctEntryModules = new Set(
    entryPoints.map((signal) => fileModules.get(signal.name)?.id).filter(Boolean),
  );
  const serviceBoundaryModules = new Set(
    serviceSymbols
      .map((symbol) => fileModules.get(symbol.path)?.id)
      .filter((id): id is string => Boolean(id) && outgoing.has(id!)),
  );
  const microserviceSignals: Signal[] = [];
  if (distinctEntryModules.size >= 2) {
    microserviceSignals.push({
      name: 'separate_entry_points',
      evidence: entryPoints.flatMap((signal) => signal.evidence),
    });
  }
  if (deploymentConfigs.length > 0) {
    microserviceSignals.push({
      name: 'deployment_configuration',
      evidence: deploymentConfigs.flatMap((signal) => signal.evidence),
    });
  }
  if (serviceBoundaryModules.size > 0) {
    microserviceSignals.push({
      name: 'service_boundary_candidates',
      evidence: serviceSymbols
        .filter((symbol) => {
          const moduleId = fileModules.get(symbol.path)?.id;
          return Boolean(moduleId && serviceBoundaryModules.has(moduleId));
        })
        .slice(0, 5)
        .map((symbol) => ({
          kind: 'symbol' as const,
          path: symbol.path,
          line: symbol.line,
          detail: `Service-named symbol in a module with cross-module imports: ${symbol.name}`,
        })),
    });
  }
  if (networkImports.length > 0) {
    microserviceSignals.push({
      name: 'network_communication_packages',
      evidence: networkImports.slice(0, 5).map((item) => ({
        kind: 'import' as const,
        path: item.path,
        line: item.line,
        detail: `Network-related package import ${item.source}`,
      })),
    });
  }
  const completeMicroserviceSignals = microserviceSignals.length === 4;
  claims.push({
    id: 'microservice-inference',
    type: 'microservice_inference',
    title: 'Microservice architecture claim withheld',
    statement: completeMicroserviceSignals
      ? 'Separate entry-point candidates, deployment configuration paths, service-boundary candidates and network package imports were observed. No microservice architecture is claimed because runtime ownership and deployed topology cannot be verified from stored source evidence.'
      : 'No microservice architecture is claimed. Folders, service-named symbols or imports alone are insufficient; separate entry points, deployment configuration, service boundaries and network communication were not all observed.',
    confidence: completeMicroserviceSignals ? 'possible' : 'unknown',
    rule: 'strict anti-microservices heuristic; no positive architecture claim from source names',
    evidence:
      microserviceSignals.length > 0
        ? microserviceSignals.flatMap((signal) => signal.evidence).slice(0, 10)
        : [
            {
              kind: 'structure',
              path: '(analysis)',
              line: null,
              detail: 'None of the required microservice signal groups were observed together',
            },
          ],
  });

  claims.sort((left, right) => left.id.localeCompare(right.id));

  const limits: string[] = [];
  if (input.fileLimitApplied) {
    limits.push('The source-analysis file limit was applied; modules and claims cover only analysed files.');
  }
  const truncatedFiles = files.filter((file) => file.status !== 'unsupported' && file.truncated).length;
  if (truncatedFiles > 0) {
    limits.push(`${truncatedFiles} parsed file(s) were truncated at symbol/import limits.`);
  }
  if (input.sourceType === 'zip') {
    limits.push('ZIP snapshots have no Git history; evolution comparison requires two stored analyses.');
  }

  return {
    repositoryId: input.repositoryId,
    projectId: input.projectId,
    commitHash: input.commitHash,
    analyzerVersion: input.analyzerVersion,
    sourceType: input.sourceType,
    basis:
      'Derived on demand from stored source-analysis paths, symbols and import edges. Directory/package membership is observed; boundary, direction and naming claims are labelled with confidence. No named architecture style or deployed topology is inferred.',
    modules: [...modules.values()].sort((left, right) => left.id.localeCompare(right.id)),
    directionality,
    claims,
    metrics: {
      moduleCount: modules.size,
      internalEdgeCount,
      crossModuleEdgeCount,
      claimCount: claims.length,
      detectedCount: claims.filter((claim) => claim.confidence === 'detected').length,
      likelyCount: claims.filter((claim) => claim.confidence === 'likely').length,
      possibleCount: claims.filter((claim) => claim.confidence === 'possible').length,
      unknownCount: claims.filter((claim) => claim.confidence === 'unknown').length,
      frameworkCount: frameworks.length,
      entryPointCount: entryPoints.length,
      deploymentConfigCount: deploymentConfigs.length,
      serviceNamingCount: serviceSymbols.length,
      networkPackageCount: networkImports.length,
    },
    limits,
  };
}

export function compareArchitectureSnapshots(
  from: ArchitectureSnapshot,
  to: ArchitectureSnapshot,
): ArchitectureEvolution {
  const fromModules = new Map(from.modules.map((module) => [module.id, module]));
  const toModules = new Map(to.modules.map((module) => [module.id, module]));
  const fromClaims = new Map(from.claims.map((claim) => [claim.id, claim]));
  const toClaims = new Map(to.claims.map((claim) => [claim.id, claim]));

  const confidenceChanges = to.claims
    .filter((claim) => fromClaims.has(claim.id))
    .flatMap((claim) => {
      const before = fromClaims.get(claim.id)!.confidence;
      return before === claim.confidence
        ? []
        : [{ id: claim.id, before, after: claim.confidence }];
    });

  return {
    fromCommitHash: from.commitHash,
    toCommitHash: to.commitHash,
    basis:
      'Difference between two architecture snapshots derived from stored source analyses. A missing module or claim means it was absent from that analysis, not that it did not exist historically.',
    addedModules: to.modules.filter((module) => !fromModules.has(module.id)),
    removedModules: from.modules.filter((module) => !toModules.has(module.id)),
    addedClaims: to.claims.filter((claim) => !fromClaims.has(claim.id)),
    removedClaims: from.claims.filter((claim) => !toClaims.has(claim.id)),
    confidenceChanges,
  };
}

function moduleForFile(file: GraphSourceFile): ModuleRef {
  const normalized = file.path.replaceAll('\\', '/');
  const namespace = file.modules.find((module) => module.kind === 'namespace')?.name;
  if (normalized.endsWith('.java') && namespace) {
    return { id: `module:package:${namespace}`, name: namespace, kind: 'java_package' };
  }
  const segments = normalized.split('/');
  const directory = segments.length > 1 ? segments.slice(0, -1).join('/') : '';
  return {
    id: `module:${directory || '/'}`,
    name: directory || '(root)',
    kind: 'directory',
  };
}

function isDeploymentConfig(path: string): boolean {
  const normalized = path.replaceAll('\\', '/').toLowerCase();
  const segments = normalized.split('/');
  return (
    segments.some((segment) => ['dockerfile', 'procfile'].includes(segment)) ||
    normalized.includes('docker-compose') ||
    normalized.startsWith('.github/workflows/') ||
    normalized.startsWith('k8s/') ||
    normalized.startsWith('terraform/') ||
    normalized.endsWith('vercel.json') ||
    normalized.endsWith('netlify.toml')
  );
}

function detectModuleCycle(edges: Array<{ source: string; target: string }>): boolean {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const targets = adjacency.get(edge.source) ?? [];
    targets.push(edge.target);
    adjacency.set(edge.source, targets);
  }
  const state = new Map<string, 0 | 1 | 2>();
  const visit = (node: string): boolean => {
    state.set(node, 1);
    for (const target of adjacency.get(node) ?? []) {
      const value = state.get(target) ?? 0;
      if (value === 1) return true;
      if (value === 0 && visit(target)) return true;
    }
    state.set(node, 2);
    return false;
  };
  for (const node of adjacency.keys()) {
    if ((state.get(node) ?? 0) === 0 && visit(node)) return true;
  }
  return false;
}

function addUnique(list: string[], value: string): void {
  if (!list.includes(value)) list.push(value);
}
