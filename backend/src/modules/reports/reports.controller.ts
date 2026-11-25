import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ObjectIdPipe } from '../../common/pipes/object-id.pipe';
import { ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post('projects/:projectId/reports')
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ObjectIdPipe) projectId: string,
  ) {
    return this.reports.generate(user.sub, projectId);
  }

  @Get('projects/:projectId/reports')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ObjectIdPipe) projectId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.reports.list(user.sub, projectId, query);
  }

  @Get('reports/:reportId')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reportId', ObjectIdPipe) reportId: string,
  ) {
    return this.reports.get(user.sub, reportId);
  }

  @Delete('reports/:reportId')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reportId', ObjectIdPipe) reportId: string,
  ) {
    return this.reports.remove(user.sub, reportId);
  }
}
