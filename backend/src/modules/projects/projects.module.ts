import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AiConversation,
  AiConversationSchema,
} from '../ai-assistant/schemas/ai-conversation.schema';
import { CodeAnalysisModule } from '../code-analysis/code-analysis.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { Report, ReportSchema } from '../reports/schemas/report.schema';
import { Project, ProjectSchema } from './schemas/project.schema';
import { ProjectsController } from './projects.controller';
import { ProjectsRepository } from './projects.repository';
import { ProjectsService } from './projects.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      { name: AiConversation.name, schema: AiConversationSchema },
      { name: Report.name, schema: ReportSchema },
    ]),
    RepositoriesModule,
    CodeAnalysisModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsRepository, ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
