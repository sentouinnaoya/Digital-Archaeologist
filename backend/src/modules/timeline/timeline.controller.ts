import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ObjectIdPipe } from '../../common/pipes/object-id.pipe';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { TimelineQueryDto } from './dto/timeline-query.dto';
import { TimelineService } from './timeline.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  @Get('projects/:projectId/timeline')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ObjectIdPipe) projectId: string,
    @Query() query: TimelineQueryDto,
  ) {
    return this.timelineService.listForProject(user.sub, projectId, query);
  }

  @Get('projects/:projectId/timeline/:eventId')
  event(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ObjectIdPipe) projectId: string,
    @Param('eventId', ObjectIdPipe) eventId: string,
  ) {
    return this.timelineService.findForProject(user.sub, projectId, eventId);
  }

  @Get('projects/:projectId/structure')
  projectStructure(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ObjectIdPipe) projectId: string,
    @Query('at') at?: string,
  ) {
    return this.timelineService.getProjectStructure(user.sub, projectId, at);
  }

  @Get('repositories/:repositoryId/structure')
  repositoryStructure(
    @CurrentUser() user: AuthenticatedUser,
    @Param('repositoryId', ObjectIdPipe) repositoryId: string,
    @Query('at') at?: string,
  ) {
    return this.timelineService.getRepositoryStructure(user.sub, repositoryId, at);
  }
}
