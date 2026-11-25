import type { TimelineCommitInput } from './timeline-event.builder';

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
  confidence: 'detected';
  basis: string;
  root: StructureNode;
}

interface FileState {
  status: string;
  hash: string;
}

export function buildReconstructedStructure(
  repositoryId: string,
  atCommitHash: string,
  commits: TimelineCommitInput[],
): ReconstructedStructure | null {
  const selectedIndex = commits.findIndex((commit) => commit.hash === atCommitHash);
  if (selectedIndex === -1) return null;

  const files = new Map<string, FileState>();
  for (const commit of commits.slice(0, selectedIndex + 1)) {
    for (const change of commit.fileChanges) {
      if (change.status === 'D') {
        files.delete(change.path);
      } else if (change.status === 'A' || change.status === 'M' || change.status === 'R' || change.status === 'T') {
        files.set(change.path, { status: change.status, hash: commit.hash });
      }
    }
  }

  const root: StructureNode = {
    path: '',
    name: '',
    type: 'directory',
    lastObservedCommitHash: null,
    lastObservedStatus: null,
    children: [],
  };

  for (const [path, state] of [...files.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) continue;
    let current = root;
    let prefix = '';
    for (const segment of segments) {
      prefix = prefix ? `${prefix}/${segment}` : segment;
      let child = current.children.find((entry) => entry.path === prefix);
      if (!child) {
        child = {
          path: prefix,
          name: segment,
          type: segment === segments[segments.length - 1] ? 'file' : 'directory',
          lastObservedCommitHash: null,
          lastObservedStatus: null,
          children: [],
        };
        current.children.push(child);
      }
      current = child;
    }
    current.type = 'file';
    current.lastObservedCommitHash = state.hash;
    current.lastObservedStatus = state.status;
  }

  return {
    repositoryId,
    atCommitHash,
    analyzedCommitCount: selectedIndex + 1,
    fileCount: files.size,
    confidence: 'detected',
    basis:
      'Reconstructed by replaying observed Git file changes up to and including the selected commit. Files never changed in the analyzed range may be absent; renames are reported under the Git-observed path.',
    root,
  };
}
