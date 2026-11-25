import { Module } from '@nestjs/common';
import { CodeAnalysisModule } from '../code-analysis/code-analysis.module';
import { DependencyAnalysisController } from './dependency-analysis.controller';
import { DependencyAnalysisService } from './dependency-analysis.service';

@Module({
  imports: [CodeAnalysisModule],
  controllers: [DependencyAnalysisController],
  providers: [DependencyAnalysisService],
  exports: [DependencyAnalysisService],
})
export class DependencyAnalysisModule {}
