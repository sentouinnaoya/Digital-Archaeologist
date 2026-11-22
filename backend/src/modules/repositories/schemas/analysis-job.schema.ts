import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export const JOB_TYPES = ['import', 'reanalyze'] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = ['queued', 'running', 'completed', 'failed'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const STEP_STATUSES = ['pending', 'running', 'completed', 'failed'] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

export interface JobStep {
  name: string;
  status: StepStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  error: string | null;
}

@Schema({ timestamps: true, collection: 'analysisJobs' })
export class AnalysisJob {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Repository',
    required: true,
    index: true,
  })
  repositoryId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  projectId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  ownerId!: Types.ObjectId;

  @Prop({ type: String, enum: JOB_TYPES, required: true })
  type!: JobType;

  @Prop({ type: String, enum: JOB_STATUSES, default: 'queued' })
  status!: JobStatus;

  @Prop({ type: Number, min: 0, max: 100, default: 0 })
  progress!: number;

  @Prop({ type: String, default: 'Queued' })
  currentStep!: string;

  @Prop({ type: String, default: null })
  error!: string | null;

  @Prop({
    type: [
      {
        name: String,
        status: { type: String, enum: STEP_STATUSES },
        startedAt: Date,
        completedAt: Date,
        error: String,
        _id: false,
      },
    ],
    default: [],
  })
  steps!: JobStep[];

  @Prop({ type: Date, default: null })
  startedAt!: Date | null;

  @Prop({ type: Date, default: null })
  completedAt!: Date | null;

  declare createdAt: Date;
  declare updatedAt: Date;
}

export type AnalysisJobDocument = HydratedDocument<AnalysisJob>;
export const AnalysisJobSchema = SchemaFactory.createForClass(AnalysisJob);
AnalysisJobSchema.index({ repositoryId: 1, createdAt: -1 });
