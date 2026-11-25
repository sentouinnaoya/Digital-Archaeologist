import { Module } from '@nestjs/common';
import { CodeAnalysisModule } from '../code-analysis/code-analysis.module';
import { DependencyAnalysisModule } from '../dependency-analysis/dependency-analysis.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { TimelineModule } from '../timeline/timeline.module';
import { HistoricalComparisonController } from './historical-comparison.controller';
import { HistoricalComparisonService } from './historical-comparison.service';

@Module({
  imports: [
    CodeAnalysisModule,
    DependencyAnalysisModule,
    RepositoriesModule,
    TimelineModule,
  ],
  controllers: [HistoricalComparisonController],
  providers: [HistoricalComparisonService],
  exports: [HistoricalComparisonService],
})
export class HistoricalComparisonModule {}
