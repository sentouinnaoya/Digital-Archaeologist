import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export const PROJECT_ANALYSIS_STATUSES = ['not_started', 'queued', 'running', 'completed', 'failed'] as const;
export type ProjectAnalysisStatus = (typeof PROJECT_ANALYSIS_STATUSES)[number];

@Schema({ timestamps: true, collection: 'projects' })
export class Project {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: true,
    index: true,
  })
  ownerId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({ type: String, default: null })
  repositoryUrl!: string | null;

  @Prop({ default: 'main' })
  defaultBranch!: string;

  @Prop({ type: String, default: null })
  primaryLanguage!: string | null;

  @Prop({ enum: PROJECT_ANALYSIS_STATUSES, default: 'not_started' })
  analysisStatus!: ProjectAnalysisStatus;

  @Prop({ type: Date, default: null })
  lastAnalyzedAt!: Date | null;

  declare createdAt: Date;
  declare updatedAt: Date;
}

export type ProjectDocument = HydratedDocument<Project>;
export const ProjectSchema = SchemaFactory.createForClass(Project);
ProjectSchema.index({ ownerId: 1, name: 1 }, { unique: true });
ProjectSchema.index({ ownerId: 1, createdAt: -1 });
