import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ObjectIdPipe } from '../../common/pipes/object-id.pipe';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CodeAnalysisService } from './code-analysis.service';
import { AnalyzeSourceDto } from './dto/analyze-source.dto';

@UseGuards(JwtAuthGuard)
@Controller('code-analysis')
export class CodeAnalysisController {
  constructor(private readonly codeAnalysisService: CodeAnalysisService) {}

  @Post('repositories/:repositoryId/analyze')
  analyze(
    @CurrentUser() user: AuthenticatedUser,
    @Param('repositoryId', ObjectIdPipe) repositoryId: string,
    @Body() dto: AnalyzeSourceDto,
  ) {
    return this.codeAnalysisService.analyzeRepository(
      user.sub,
      repositoryId,
      dto.commitHash,
      dto.refresh ?? false,
    );
  }

  @Get('repositories/:repositoryId/latest')
  repositoryLatest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('repositoryId', ObjectIdPipe) repositoryId: string,
  ) {
    return this.codeAnalysisService.getRepositoryLatest(user.sub, repositoryId);
  }

  @Get('projects/:projectId/latest')
  projectLatest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ObjectIdPipe) projectId: string,
  ) {
    return this.codeAnalysisService.getProjectLatest(user.sub, projectId);
  }
}
