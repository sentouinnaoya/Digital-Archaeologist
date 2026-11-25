import { Module } from '@nestjs/common';
import { ArchitectureAnalysisModule } from '../architecture-analysis/architecture-analysis.module';
import { CodeAnalysisModule } from '../code-analysis/code-analysis.module';
import { DependencyAnalysisModule } from '../dependency-analysis/dependency-analysis.module';
import { ProjectsModule } from '../projects/projects.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { TimelineModule } from '../timeline/timeline.module';
import { ProjectEvidenceService } from './project-evidence.service';

@Module({
  imports: [
    ProjectsModule,
    RepositoriesModule,
    TimelineModule,
    CodeAnalysisModule,
    DependencyAnalysisModule,
    ArchitectureAnalysisModule,
  ],
  providers: [ProjectEvidenceService],
  exports: [ProjectEvidenceService],
})
export class EvidenceModule {}
