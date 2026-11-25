import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ObjectIdPipe } from '../../common/pipes/object-id.pipe';
import { ArchitectureAnalysisService } from './architecture-analysis.service';
import {
  ArchitectureCompareDto,
  ArchitectureQueryDto,
} from './dto/architecture-query.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class ArchitectureAnalysisController {
  constructor(private readonly architectureAnalysisService: ArchitectureAnalysisService) {}

  @Get('projects/:projectId/architecture/history')
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ObjectIdPipe) projectId: string,
    @Query() query: ArchitectureCompareDto,
  ) {
    return this.architectureAnalysisService.compareProjectArchitecture(
      user.sub,
      projectId,
      query.from,
      query.to,
    );
  }

  @Get('projects/:projectId/architecture')
  project(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ObjectIdPipe) projectId: string,
    @Query() query: ArchitectureQueryDto,
  ) {
    return this.architectureAnalysisService.getProjectArchitecture(
      user.sub,
      projectId,
      query.commitHash,
    );
  }

  @Get('repositories/:repositoryId/architecture')
  repository(
    @CurrentUser() user: AuthenticatedUser,
    @Param('repositoryId', ObjectIdPipe) repositoryId: string,
    @Query() query: ArchitectureQueryDto,
  ) {
    return this.architectureAnalysisService.getRepositoryArchitecture(
      user.sub,
      repositoryId,
      query.commitHash,
    );
  }
}
