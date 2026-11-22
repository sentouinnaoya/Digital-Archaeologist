import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'node:path';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { RepositoriesModule } from './modules/repositories/repositories.module';
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
    HealthModule,
  ],
})
export class AppModule {}
