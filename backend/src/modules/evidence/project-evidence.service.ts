import { Injectable, NotFoundException } from '@nestjs/common';
import { ArchitectureAnalysisService } from '../architecture-analysis/architecture-analysis.service';
import type { ArchitectureSnapshot } from '../architecture-analysis/architecture.builder';
import { CodeAnalysisService } from '../code-analysis/code-analysis.service';
import type { SourceAnalysisView } from '../code-analysis/code-analysis.service';
import { DependencyAnalysisService } from '../dependency-analysis/dependency-analysis.service';
import type { DependencyGraph } from '../dependency-analysis/dependency-graph.builder';
import { ProjectsService } from '../projects/projects.service';
import type { ProjectView } from '../projects/projects.service';
import { RepositoriesService } from '../repositories/repositories.service';
import type { RepositoryView } from '../repositories/repositories.service';
import { TimelineService } from '../timeline/timeline.service';
import type { TimelineEventView } from '../timeline/timeline.service';

export interface ProjectEvidence {
  project: ProjectView;
  repository: RepositoryView | null;
  timeline: TimelineEventView[];
  analysis: SourceAnalysisView | null;
  graph: DependencyGraph | null;
  architecture: ArchitectureSnapshot | null;
  unavailable: string[];
}

@Injectable()
export class ProjectEvidenceService {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly repositoriesService: RepositoriesService,
    private readonly timelineService: TimelineService,
    private readonly codeAnalysisService: CodeAnalysisService,
    private readonly dependencyAnalysisService: DependencyAnalysisService,
    private readonly architectureAnalysisService: ArchitectureAnalysisService,
  ) {}

  async gather(ownerId: string, projectId: string): Promise<ProjectEvidence> {
    // get() re-checks ownerId and is the single existence gate for this project.
    const project = await this.projectsService.get(ownerId, projectId);
    const repository = (
      await this.repositoriesService.getProjectRepository(ownerId, projectId)
    ).repository;
    const timeline = (
      await this.timelineService.listForProject(ownerId, projectId, {
        page: 1,
        limit: 20,
      })
    ).items;

    const unavailable: string[] = [];
    let analysis: SourceAnalysisView | null = null;
    try {
      analysis = await this.codeAnalysisService.getProjectLatest(ownerId, projectId);
    } catch (error) {
      if (!(error instanceof NotFoundException)) throw error;
      unavailable.push('No stored source analysis was available for this project.');
    }

    let graph: DependencyGraph | null = null;
    let architecture: ArchitectureSnapshot | null = null;
    if (analysis) {
      try {
        graph = await this.dependencyAnalysisService.getProjectGraph(
          ownerId,
          projectId,
          analysis.commitHash,
        );
      } catch (error) {
        if (!(error instanceof NotFoundException)) throw error;
        unavailable.push('Dependency comparison was unavailable for the analysed commit.');
      }
      try {
        architecture = await this.architectureAnalysisService.getProjectArchitecture(
          ownerId,
          projectId,
          analysis.commitHash,
        );
      } catch (error) {
        if (!(error instanceof NotFoundException)) throw error;
        unavailable.push('Architecture evidence was unavailable for the analysed commit.');
      }
    }

    return {
      project,
      repository,
      timeline,
      analysis,
      graph,
      architecture,
      unavailable,
    };
  }
}
