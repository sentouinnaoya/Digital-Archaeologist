import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Project, ProjectSchema } from '../projects/schemas/project.schema';
import { RepositoriesController } from './repositories.controller';
import { RepositoriesRepository } from './repositories.repository';
import { RepositoriesService } from './repositories.service';
import { GitService } from './git.service';
import { RemoteUrlValidator } from './remote-url.validator';
import { RepositoryStorageService } from './repository-storage.service';
import { AnalysisJob, AnalysisJobSchema } from './schemas/analysis-job.schema';
import { Commit, CommitSchema } from './schemas/commit.schema';
import { Repository, RepositorySchema } from './schemas/repository.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Repository.name, schema: RepositorySchema },
      { name: Commit.name, schema: CommitSchema },
      { name: AnalysisJob.name, schema: AnalysisJobSchema },
      { name: Project.name, schema: ProjectSchema },
    ]),
  ],
  controllers: [RepositoriesController],
  providers: [
    RepositoriesRepository,
    RepositoryStorageService,
    RemoteUrlValidator,
    GitService,
    RepositoriesService,
  ],
  exports: [RepositoriesService],
})
export class RepositoriesModule {}
