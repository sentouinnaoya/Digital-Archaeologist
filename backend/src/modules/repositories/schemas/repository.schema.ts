import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export const REPOSITORY_STATUSES = ['importing', 'ready', 'failed'] as const;
export type RepositoryStatus = (typeof REPOSITORY_STATUSES)[number];

export const LICENSE_CONFIDENCE = ['detected', 'likely', 'unknown'] as const;
export type LicenseConfidence = (typeof LICENSE_CONFIDENCE)[number];

export interface LicenseDetection {
  identifier: string;
  confidence: LicenseConfidence;
  path: string | null;
}

@Schema({ timestamps: true, collection: 'repositories' })
export class Repository {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    required: true,
    unique: true,
    index: true,
  })
  projectId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  ownerId!: Types.ObjectId;

  @Prop({ type: String, enum: ['git_url'], required: true })
  sourceType!: 'git_url';

  @Prop({ required: true })
  repositoryUrl!: string;

  @Prop({ required: true })
  defaultBranch!: string;

  @Prop({ required: true })
  localStorageReference!: string;

  @Prop({ type: String, enum: REPOSITORY_STATUSES, default: 'importing' })
  status!: RepositoryStatus;

  @Prop({
    type: {
      identifier: String,
      confidence: { type: String, enum: LICENSE_CONFIDENCE },
      path: String,
    },
    default: null,
  })
  license!: LicenseDetection | null;

  @Prop({ type: [String], default: [] })
  branches!: string[];

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ type: String, default: null })
  headCommitHash!: string | null;

  @Prop({ type: Number, default: 0 })
  totalCommitCount!: number;

  @Prop({ type: Number, default: 0 })
  analyzedCommitCount!: number;

  @Prop({ type: [String], default: [] })
  detectedLanguages!: string[];

  @Prop({ type: Date, default: null })
  lastImportedAt!: Date | null;

  @Prop({ type: Date, default: null })
  lastAnalyzedAt!: Date | null;

  @Prop({ type: String, default: null })
  lastError!: string | null;

  declare createdAt: Date;
  declare updatedAt: Date;
}

export type RepositoryDocument = HydratedDocument<Repository>;
export const RepositorySchema = SchemaFactory.createForClass(Repository);
RepositorySchema.index({ ownerId: 1, createdAt: -1 });
