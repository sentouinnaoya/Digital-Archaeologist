import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import type { Page } from '../../common/interfaces/page.interface';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { ProjectEvidenceService } from '../evidence/project-evidence.service';
import { buildProjectReport } from './report.builder';
import { ReportsRepository } from './reports.repository';
import { ReportDocument } from './schemas/report.schema';

export interface ReportView {
  id: string;
  projectId: string;
  title: string;
  format: string;
  content: string;
  basis: string;
  evidenceIds: string[];
  limits: string[];
  createdAt: string;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly config: ConfigService,
    private readonly evidenceService: ProjectEvidenceService,
    private readonly repository: ReportsRepository,
  ) {}

  async generate(ownerId: string, projectId: string): Promise<ReportView> {
    const evidence = await this.evidenceService.gather(ownerId, projectId);
    const built = buildProjectReport({
      evidence,
      generatedAt: new Date(),
      maxItems: this.config.getOrThrow<number>('REPORT_MAX_ITEMS'),
    });
    const report = await this.repository.create({
      ownerId: new Types.ObjectId(ownerId),
      projectId: new Types.ObjectId(projectId),
      format: 'markdown',
      ...built,
    });
    return this.toView(report);
  }

  async list(
    ownerId: string,
    projectId: string,
    query: PaginationQueryDto,
  ): Promise<Page<ReportView>> {
    const { items, total } = await this.repository.findByProjectAndOwner(
      new Types.ObjectId(projectId),
      new Types.ObjectId(ownerId),
      (query.page - 1) * query.limit,
      query.limit,
    );
    return {
      items: items.map((item) => this.toView(item)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async get(ownerId: string, reportId: string): Promise<ReportView> {
    const report = await this.repository.findByIdAndOwner(
      new Types.ObjectId(reportId),
      new Types.ObjectId(ownerId),
    );
    if (!report) throw new NotFoundException('Report not found');
    return this.toView(report);
  }

  async remove(ownerId: string, reportId: string): Promise<void> {
    const deleted = await this.repository.deleteByIdAndOwner(
      new Types.ObjectId(reportId),
      new Types.ObjectId(ownerId),
    );
    if (!deleted) throw new NotFoundException('Report not found');
  }

  private toView(report: ReportDocument): ReportView {
    return {
      id: report.id,
      projectId: report.projectId.toString(),
      title: report.title,
      format: report.format,
      content: report.content,
      basis: report.basis,
      evidenceIds: report.evidenceIds,
      limits: report.limits,
      createdAt: report.createdAt.toISOString(),
    };
  }
}
