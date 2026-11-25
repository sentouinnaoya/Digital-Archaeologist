import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RepositoriesModule } from '../repositories/repositories.module';
import {
  SnapshotFile,
  SnapshotFileSchema,
} from '../repositories/schemas/snapshot-file.schema';
import { Repository, RepositorySchema } from '../repositories/schemas/repository.schema';
import { CodeAnalysisController } from './code-analysis.controller';
import { CodeAnalysisRepository } from './code-analysis.repository';
import { CodeAnalysisService } from './code-analysis.service';
import {
  AnalysisSnapshot,
  AnalysisSnapshotSchema,
} from './schemas/analysis-snapshot.schema';

@Module({
  imports: [
    RepositoriesModule,
    MongooseModule.forFeature([
      { name: AnalysisSnapshot.name, schema: AnalysisSnapshotSchema },
      { name: Repository.name, schema: RepositorySchema },
      { name: SnapshotFile.name, schema: SnapshotFileSchema },
    ]),
  ],
  controllers: [CodeAnalysisController],
  providers: [CodeAnalysisRepository, CodeAnalysisService],
  exports: [CodeAnalysisService, CodeAnalysisRepository],
})
export class CodeAnalysisModule {}
