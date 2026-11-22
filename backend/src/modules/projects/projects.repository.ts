import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UpdateProjectDto } from './dto/create-project.dto';
import { Project, ProjectDocument } from './schemas/project.schema';

export interface CreateProjectInput {
  ownerId: Types.ObjectId;
  name: string;
  description: string;
  repositoryUrl: string | null;
  defaultBranch: string;
  primaryLanguage: string | null;
}

@Injectable()
export class ProjectsRepository {
  constructor(
    @InjectModel(Project.name)
    private readonly projectModel: Model<ProjectDocument>,
  ) {}

  create(input: CreateProjectInput): Promise<ProjectDocument> {
    return this.projectModel.create(input);
  }

  async findByOwner(
    ownerId: Types.ObjectId,
    skip: number,
    limit: number,
  ): Promise<{ items: ProjectDocument[]; total: number }> {
    const filter = { ownerId };
    const [items, total] = await Promise.all([
      this.projectModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.projectModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  findByIdAndOwner(
    id: string,
    ownerId: Types.ObjectId,
  ): Promise<ProjectDocument | null> {
    return this.projectModel.findOne({ _id: id, ownerId }).exec();
  }

  updateByIdAndOwner(
    id: string,
    ownerId: Types.ObjectId,
    patch: UpdateProjectDto,
  ): Promise<ProjectDocument | null> {
    return this.projectModel
      .findOneAndUpdate(
        { _id: id, ownerId },
        { $set: patch },
        { returnDocument: 'after', runValidators: true },
      )
      .exec();
  }

  async deleteByIdAndOwner(id: string, ownerId: Types.ObjectId): Promise<boolean> {
    const result = await this.projectModel.deleteOne({ _id: id, ownerId }).exec();
    return result.deletedCount === 1;
  }
}
