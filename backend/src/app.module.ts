import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'node:path';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { AiAssistantModule } from './modules/ai-assistant/ai-assistant.module';
import { ArchitectureAnalysisModule } from './modules/architecture-analysis/architecture-analysis.module';
import { DependencyAnalysisModule } from './modules/dependency-analysis/dependency-analysis.module';
import { HistoricalComparisonModule } from './modules/historical-comparison/historical-comparison.module';
import { AuthModule } from './modules/auth/auth.module';
import { CodeAnalysisModule } from './modules/code-analysis/code-analysis.module';
import { HealthModule } from './modules/health/health.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { RepositoriesModule } from './modules/repositories/repositories.module';
import { ReportsModule } from './modules/reports/reports.module';
import { TimelineModule } from './modules/timeline/timeline.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      envFilePath: [
        join(__dirname, '..', '..', '.env'),
        join(process.cwd(), '.env'),
        join(__dirname, '..', '..', '.env.local'),
      ],
    }),
    DatabaseModule,
    UsersModule,
    AuthModule,
    ProjectsModule,
    RepositoriesModule,
    TimelineModule,
    CodeAnalysisModule,
    DependencyAnalysisModule,
    ArchitectureAnalysisModule,
    HistoricalComparisonModule,
    AiAssistantModule,
    ReportsModule,
    HealthModule,
  ],
})
export class AppModule {}
