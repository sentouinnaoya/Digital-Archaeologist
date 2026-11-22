import { Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import type { Page } from '../../common/interfaces/page.interface';
import { RepositoriesService } from '../repositories/repositories.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';
import {
  CreateProjectInput,
  ProjectsRepository,
} from './projects.repository';
import { ProjectDocument } from './schemas/project.schema';

export interface ProjectView {
  id: string;
  name: string;
  description: string;
  repositoryUrl: string | null;
  defaultBranch: string;
  primaryLanguage: string | null;
  analysisStatus: string;
  lastAnalyzedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly projectsRepository: ProjectsRepository,
    private readonly repositoriesService: RepositoriesService,
  ) {}

  async create(ownerId: string, dto: CreateProjectDto): Promise<ProjectView> {
    const input: CreateProjectInput = {
      ownerId: new Types.ObjectId(ownerId),
      name: dto.name.trim(),
      description: dto.description?.trim() ?? '',
      repositoryUrl: dto.repositoryUrl?.trim() ?? null,
      defaultBranch: dto.defaultBranch?.trim() ?? 'main',
      primaryLanguage: dto.primaryLanguage?.trim() ?? null,
    };
    return this.toView(await this.projectsRepository.create(input));
  }

  async list(
    ownerId: string,
    page: number,
    limit: number,
  ): Promise<Page<ProjectView>> {
    const owner = new Types.ObjectId(ownerId);
    const { items, total } = await this.projectsRepository.findByOwner(
      owner,
      (page - 1) * limit,
      limit,
    );
    return {
      items: items.map((item) => this.toView(item)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async get(ownerId: string, projectId: string): Promise<ProjectView> {
    const project = await this.projectsRepository.findByIdAndOwner(
      projectId,
      new Types.ObjectId(ownerId),
    );
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return this.toView(project);
  }

  async update(
    ownerId: string,
    projectId: string,
    dto: UpdateProjectDto,
  ): Promise<ProjectView> {
    const patch: UpdateProjectDto = {};
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.description !== undefined) patch.description = dto.description.trim();
    if (dto.repositoryUrl !== undefined) patch.repositoryUrl = dto.repositoryUrl.trim();
    if (dto.defaultBranch !== undefined) patch.defaultBranch = dto.defaultBranch.trim();
    if (dto.primaryLanguage !== undefined) patch.primaryLanguage = dto.primaryLanguage.trim();

    const project = await this.projectsRepository.updateByIdAndOwner(
      projectId,
      new Types.ObjectId(ownerId),
      patch,
    );
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return this.toView(project);
  }

  async remove(ownerId: string, projectId: string): Promise<void> {
    const removed = await this.projectsRepository.deleteByIdAndOwner(
      projectId,
      new Types.ObjectId(ownerId),
    );
    if (!removed) {
      throw new NotFoundException('Project not found');
    }
    await this.repositoriesService.deleteProjectData(projectId, ownerId);
  }

  private toView(project: ProjectDocument): ProjectView {
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      repositoryUrl: project.repositoryUrl,
      defaultBranch: project.defaultBranch,
      primaryLanguage: project.primaryLanguage,
      analysisStatus: project.analysisStatus,
      lastAnalyzedAt: project.lastAnalyzedAt,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }
}
