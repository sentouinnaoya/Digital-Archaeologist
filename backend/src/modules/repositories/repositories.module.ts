import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { MongooseModule } from '@nestjs/mongoose';
import multer from 'multer';
import { Project, ProjectSchema } from '../projects/schemas/project.schema';
import { TimelineModule } from '../timeline/timeline.module';
import { RepositoriesController } from './repositories.controller';
import { RepositoriesRepository } from './repositories.repository';
import { RepositoriesService } from './repositories.service';
import { GitService } from './git.service';
import { RemoteUrlValidator } from './remote-url.validator';
import { RepositoryStorageService } from './repository-storage.service';
import { AnalysisJob, AnalysisJobSchema } from './schemas/analysis-job.schema';
import { Commit, CommitSchema } from './schemas/commit.schema';
import { Repository, RepositorySchema } from './schemas/repository.schema';
import {
  SnapshotFile,
  SnapshotFileSchema,
} from './schemas/snapshot-file.schema';
import { ZipImportService } from './zip-import.service';

@Module({
  imports: [
    TimelineModule,
    MongooseModule.forFeature([
      { name: Repository.name, schema: RepositorySchema },
      { name: Commit.name, schema: CommitSchema },
      { name: AnalysisJob.name, schema: AnalysisJobSchema },
      { name: SnapshotFile.name, schema: SnapshotFileSchema },
      { name: Project.name, schema: ProjectSchema },
    ]),
    MulterModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        storage: multer.memoryStorage(),
        limits: {
          files: 1,
          fileSize:
            Number(configService.get('MAX_ZIP_SIZE_MB') ?? 50) * 1024 * 1024,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [RepositoriesController],
  providers: [
    RepositoriesRepository,
    RepositoryStorageService,
    RemoteUrlValidator,
    GitService,
    ZipImportService,
    RepositoriesService,
  ],
  exports: [RepositoriesService, GitService, RepositoryStorageService],
})
export class RepositoriesModule {}
