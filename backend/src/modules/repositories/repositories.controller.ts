import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ObjectIdPipe } from '../../common/pipes/object-id.pipe';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ImportRepositoryDto } from './dto/import-repository.dto';
import { RepositoriesService } from './repositories.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class RepositoriesController {
  constructor(private readonly repositoriesService: RepositoriesService) {}

  @Post('repositories/import')
  @HttpCode(HttpStatus.ACCEPTED)
  import(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ImportRepositoryDto,
  ) {
    return this.repositoriesService.importRepository(user.sub, dto);
  }

  @Get('repositories/projects/:projectId/status')
  projectStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ObjectIdPipe) projectId: string,
  ) {
    return this.repositoriesService.getProjectRepository(user.sub, projectId);
  }

  @Get('repositories/projects/:projectId/commits')
  projectCommits(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ObjectIdPipe) projectId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.repositoriesService.listProjectCommits(
      user.sub,
      projectId,
      query.page,
      query.limit,
    );
  }

  @Get('repositories/projects/:projectId/branches')
  projectBranches(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ObjectIdPipe) projectId: string,
  ) {
    return this.repositoriesService.listProjectBranches(user.sub, projectId);
  }

  @Get('repositories/projects/:projectId/tags')
  projectTags(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ObjectIdPipe) projectId: string,
  ) {
    return this.repositoriesService.listProjectTags(user.sub, projectId);
  }

  @Get('repositories/projects/:projectId/contributors')
  projectContributors(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ObjectIdPipe) projectId: string,
  ) {
    return this.repositoriesService.listProjectContributors(user.sub, projectId);
  }

  @Get('repositories/:repositoryId')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('repositoryId', ObjectIdPipe) repositoryId: string,
  ) {
    return this.repositoriesService.getRepository(user.sub, repositoryId);
  }

  @Get('repositories/:repositoryId/status')
  status(
    @CurrentUser() user: AuthenticatedUser,
    @Param('repositoryId', ObjectIdPipe) repositoryId: string,
  ) {
    return this.repositoriesService.getStatus(user.sub, repositoryId);
  }

  @Post('repositories/:repositoryId/analyze')
  @HttpCode(HttpStatus.ACCEPTED)
  analyze(
    @CurrentUser() user: AuthenticatedUser,
    @Param('repositoryId', ObjectIdPipe) repositoryId: string,
  ) {
    return this.repositoriesService.reanalyze(user.sub, repositoryId);
  }

  @Get('repositories/:repositoryId/commits')
  commits(
    @CurrentUser() user: AuthenticatedUser,
    @Param('repositoryId', ObjectIdPipe) repositoryId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.repositoriesService.listCommits(
      user.sub,
      repositoryId,
      query.page,
      query.limit,
    );
  }

  @Get('repositories/:repositoryId/branches')
  branches(
    @CurrentUser() user: AuthenticatedUser,
    @Param('repositoryId', ObjectIdPipe) repositoryId: string,
  ) {
    return this.repositoriesService.listBranches(user.sub, repositoryId);
  }

  @Get('repositories/:repositoryId/tags')
  tags(
    @CurrentUser() user: AuthenticatedUser,
    @Param('repositoryId', ObjectIdPipe) repositoryId: string,
  ) {
    return this.repositoriesService.listTags(user.sub, repositoryId);
  }

  @Get('repositories/:repositoryId/contributors')
  contributors(
    @CurrentUser() user: AuthenticatedUser,
    @Param('repositoryId', ObjectIdPipe) repositoryId: string,
  ) {
    return this.repositoriesService.listContributors(user.sub, repositoryId);
  }

  @Get('repositories/:repositoryId/jobs')
  jobs(
    @CurrentUser() user: AuthenticatedUser,
    @Param('repositoryId', ObjectIdPipe) repositoryId: string,
  ) {
    return this.repositoriesService.listJobs(user.sub, repositoryId);
  }
}
