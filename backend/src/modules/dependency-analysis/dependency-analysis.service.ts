import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { CodeAnalysisRepository } from '../code-analysis/code-analysis.repository';
import type { AnalysisSnapshotDocument } from '../code-analysis/schemas/analysis-snapshot.schema';
import {
  buildDependencyGraph,
  compareDependencyGraphs,
  type DependencyCycle,
  type DependencyGraph,
  type GraphComparison,
  type GraphSnapshotInput,
} from './dependency-graph.builder';

@Injectable()
export class DependencyAnalysisService {
  constructor(private readonly codeAnalysisRepository: CodeAnalysisRepository) {}

  async getProjectGraph(
    ownerId: string,
    projectId: string,
    commitHash?: string,
  ): Promise<DependencyGraph> {
    const owner = new Types.ObjectId(ownerId);
    const id = new Types.ObjectId(projectId);
    const snapshot = commitHash
      ? await this.codeAnalysisRepository.findByProjectAndCommit(id, owner, commitHash)
      : await this.findByProjectLatest(id, owner);
    return this.toGraph(snapshot, id.toString());
  }

  async getRepositoryGraph(
    ownerId: string,
    repositoryId: string,
    commitHash?: string,
  ): Promise<DependencyGraph> {
    const owner = new Types.ObjectId(ownerId);
    const id = new Types.ObjectId(repositoryId);
    const snapshot = commitHash
      ? await this.codeAnalysisRepository.findByRepositoryAndCommit(id, owner, commitHash)
      : await this.codeAnalysisRepository.findLatest(id, owner);
    return this.toGraph(snapshot, id.toString());
  }

  async getProjectCycles(
    ownerId: string,
    projectId: string,
    commitHash?: string,
  ): Promise<DependencyCycle[]> {
    const graph = await this.getProjectGraph(ownerId, projectId, commitHash);
    return graph.cycles;
  }

  async compareProjectGraphs(
    ownerId: string,
    projectId: string,
    fromCommitHash: string,
    toCommitHash: string,
  ): Promise<GraphComparison> {
    const owner = new Types.ObjectId(ownerId);
    const id = new Types.ObjectId(projectId);
    this.assertCommitKey(fromCommitHash);
    this.assertCommitKey(toCommitHash);
    const [from, to] = await Promise.all([
      this.codeAnalysisRepository.findByProjectAndCommit(id, owner, fromCommitHash),
      this.codeAnalysisRepository.findByProjectAndCommit(id, owner, toCommitHash),
    ]);
    if (!from || !to) {
      throw new NotFoundException(
        'Both commits must have stored source analysis before graphs can be compared',
      );
    }
    return compareDependencyGraphs(
      buildDependencyGraph(this.toInput(from)),
      buildDependencyGraph(this.toInput(to)),
    );
  }

  private async findByProjectLatest(projectId: Types.ObjectId, ownerId: Types.ObjectId) {
    const repository = await this.codeAnalysisRepository.findRepositoryByProjectAndOwner(
      projectId,
      ownerId,
    );
    if (!repository) throw new NotFoundException('Repository not found');
    return this.codeAnalysisRepository.findLatest(repository._id, ownerId);
  }

  private toGraph(snapshot: AnalysisSnapshotDocument | null, scopeId: string): DependencyGraph {
    if (!snapshot) {
      throw new NotFoundException(
        `No stored source analysis is available for ${scopeId}. Run source analysis first.`,
      );
    }
    return buildDependencyGraph(this.toInput(snapshot));
  }

  private toInput(snapshot: AnalysisSnapshotDocument): GraphSnapshotInput {
    return {
      repositoryId: snapshot.repositoryId.toString(),
      projectId: snapshot.projectId.toString(),
      commitHash: snapshot.commitHash,
      analyzerVersion: snapshot.analyzerVersion,
      sourceType: snapshot.sourceType,
      files: snapshot.files.map((file) => ({
        path: file.path,
        language: file.language,
        parser: file.parser,
        status: file.status,
        imports: file.imports ?? [],
        modules: file.modules ?? [],
        symbols: file.symbols ?? [],
      })),
    };
  }

  private assertCommitKey(value: string): void {
    if (value !== 'snapshot' && !/^[0-9a-f]{4,40}$/i.test(value)) {
      throw new BadRequestException('Invalid commit hash');
    }
  }
}
