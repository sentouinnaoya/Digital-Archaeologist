import { Module } from '@nestjs/common';
import { CodeAnalysisModule } from '../code-analysis/code-analysis.module';
import { ArchitectureAnalysisController } from './architecture-analysis.controller';
import { ArchitectureAnalysisService } from './architecture-analysis.service';

@Module({
  imports: [CodeAnalysisModule],
  controllers: [ArchitectureAnalysisController],
  providers: [ArchitectureAnalysisService],
  exports: [ArchitectureAnalysisService],
})
export class ArchitectureAnalysisModule {}
