import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ObjectIdPipe } from '../../common/pipes/object-id.pipe';
import { DependencyAnalysisService } from './dependency-analysis.service';
import {
  DependencyCompareDto,
  DependencyQueryDto,
} from './dto/dependency-query.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class DependencyAnalysisController {
  constructor(private readonly dependencyAnalysisService: DependencyAnalysisService) {}

  @Get('projects/:projectId/dependencies')
  projectGraph(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ObjectIdPipe) projectId: string,
    @Query() query: DependencyQueryDto,
  ) {
    return this.dependencyAnalysisService.getProjectGraph(
      user.sub,
      projectId,
      query.commitHash,
    );
  }

  @Get('projects/:projectId/dependencies/cycles')
  projectCycles(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ObjectIdPipe) projectId: string,
    @Query() query: DependencyQueryDto,
  ) {
    return this.dependencyAnalysisService.getProjectCycles(
      user.sub,
      projectId,
      query.commitHash,
    );
  }

  @Get('projects/:projectId/dependencies/compare')
  compare(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ObjectIdPipe) projectId: string,
    @Query() query: DependencyCompareDto,
  ) {
    return this.dependencyAnalysisService.compareProjectGraphs(
      user.sub,
      projectId,
      query.from,
      query.to,
    );
  }

  @Get('repositories/:repositoryId/dependencies')
  repositoryGraph(
    @CurrentUser() user: AuthenticatedUser,
    @Param('repositoryId', ObjectIdPipe) repositoryId: string,
    @Query() query: DependencyQueryDto,
  ) {
    return this.dependencyAnalysisService.getRepositoryGraph(
      user.sub,
      repositoryId,
      query.commitHash,
    );
  }
}
