import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type TimelineEventType =
  | 'commit'
  | 'file_added'
  | 'file_modified'
  | 'file_deleted'
  | 'file_renamed'
  | 'snapshot';

export type TimelineConfidence = 'detected' | 'likely' | 'possible' | 'unknown';

export interface TimelineEvidence {
  kind: 'commit' | 'file' | 'structure';
  commitHash: string | null;
  path: string | null;
  detail: string;
}

@Schema({ timestamps: true, collection: 'timelineEvents' })
export class TimelineEvent {
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

  @Prop({ type: String, required: true })
  type!: TimelineEventType;

  @Prop({ type: Date, required: true })
  occurredAt!: Date;

  @Prop({ type: String, required: true })
  title!: string;

  @Prop({ type: String, default: '' })
  description!: string;

  @Prop({ type: String, enum: ['detected', 'likely', 'possible', 'unknown'], required: true })
  confidence!: TimelineConfidence;

  @Prop({ type: String, default: null })
  commitHash!: string | null;

  @Prop({ type: String, default: null })
  contributorEmail!: string | null;

  @Prop({ type: String, default: null })
  contributorName!: string | null;

  @Prop({ type: [String], default: [] })
  paths!: string[];

  @Prop({
    type: [
      {
        kind: String,
        commitHash: String,
        path: String,
        detail: String,
        _id: false,
      },
    ],
    default: [],
  })
  evidence!: TimelineEvidence[];

  declare createdAt: Date;
  declare updatedAt: Date;
}

export type TimelineEventDocument = HydratedDocument<TimelineEvent>;
export const TimelineEventSchema = SchemaFactory.createForClass(TimelineEvent);
TimelineEventSchema.index({ repositoryId: 1, occurredAt: -1 });
TimelineEventSchema.index({ projectId: 1, ownerId: 1, occurredAt: -1 });
TimelineEventSchema.index({ projectId: 1, ownerId: 1, type: 1, occurredAt: -1 });
