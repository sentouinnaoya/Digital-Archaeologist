import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Report, ReportDocument } from './schemas/report.schema';

export interface ReportCreateInput {
  ownerId: Types.ObjectId;
  projectId: Types.ObjectId;
  title: string;
  format: string;
  content: string;
  basis: string;
  evidenceIds: string[];
  limits: string[];
}

@Injectable()
export class ReportsRepository {
  constructor(
    @InjectModel(Report.name)
    private readonly model: Model<ReportDocument>,
  ) {}

  create(input: ReportCreateInput): Promise<ReportDocument> {
    return this.model.create(input);
  }

  async findByProjectAndOwner(
    projectId: Types.ObjectId,
    ownerId: Types.ObjectId,
    skip: number,
    limit: number,
  ): Promise<{ items: ReportDocument[]; total: number }> {
    const [items, total] = await Promise.all([
      this.model
        .find({ projectId, ownerId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.model.countDocuments({ projectId, ownerId }).exec(),
    ]);
    return { items, total };
  }

  findByIdAndOwner(
    reportId: Types.ObjectId,
    ownerId: Types.ObjectId,
  ): Promise<ReportDocument | null> {
    return this.model.findOne({ _id: reportId, ownerId }).exec();
  }

  async deleteByIdAndOwner(
    reportId: Types.ObjectId,
    ownerId: Types.ObjectId,
  ): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: reportId, ownerId }).exec();
    return result.deletedCount === 1;
  }
}
