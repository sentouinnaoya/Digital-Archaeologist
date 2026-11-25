import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ObjectIdPipe } from '../../common/pipes/object-id.pipe';
import {
  ProjectComparisonQueryDto,
  ProjectFileComparisonQueryDto,
  RepositoryComparisonQueryDto,
  RepositoryFileComparisonQueryDto,
} from './dto/comparison-query.dto';
import { HistoricalComparisonService } from './historical-comparison.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class HistoricalComparisonController {
  constructor(private readonly comparisonService: HistoricalComparisonService) {}

  @Get('projects/:projectId/compare/files')
  projectFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ObjectIdPipe) projectId: string,
    @Query() query: ProjectFileComparisonQueryDto,
  ) {
    return this.comparisonService.compareProjectFile(
      user.sub,
      projectId,
      query.from,
      query.to,
      query.path,
    );
  }

  @Get('projects/:projectId/compare')
  project(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ObjectIdPipe) projectId: string,
    @Query() query: ProjectComparisonQueryDto,
  ) {
    return this.comparisonService.compareProject(
      user.sub,
      projectId,
      query.from,
      query.to,
    );
  }

  @Get('repositories/:repositoryId/compare/files')
  repositoryFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('repositoryId', ObjectIdPipe) repositoryId: string,
    @Query() query: RepositoryFileComparisonQueryDto,
  ) {
    return this.comparisonService.compareRepositoryFile(
      user.sub,
      repositoryId,
      query.fromCommit,
      query.toCommit,
      query.path,
    );
  }

  @Get('repositories/:repositoryId/compare')
  repository(
    @CurrentUser() user: AuthenticatedUser,
    @Param('repositoryId', ObjectIdPipe) repositoryId: string,
    @Query() query: RepositoryComparisonQueryDto,
  ) {
    return this.comparisonService.compareRepository(
      user.sub,
      repositoryId,
      query.fromCommit,
      query.toCommit,
    );
  }
}
