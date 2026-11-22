import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export interface CommitFileChange {
  status: string;
  path: string;
}

@Schema({ timestamps: true, collection: 'commits' })
export class Commit {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Repository',
    required: true,
    index: true,
  })
  repositoryId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  ownerId!: Types.ObjectId;

  @Prop({ required: true })
  hash!: string;

  @Prop({ required: true })
  message!: string;

  @Prop({ required: true })
  authorName!: string;

  @Prop({ required: true })
  authorEmail!: string;

  @Prop({ type: Date, required: true })
  authoredAt!: Date;

  @Prop({ type: Date, required: true })
  committedAt!: Date;

  @Prop({ type: [String], default: [] })
  parentHashes!: string[];

  @Prop({
    type: [{ status: String, path: String, _id: false }],
    default: [],
  })
  fileChanges!: CommitFileChange[];

  declare createdAt: Date;
  declare updatedAt: Date;
}

export type CommitDocument = HydratedDocument<Commit>;
export const CommitSchema = SchemaFactory.createForClass(Commit);
CommitSchema.index({ repositoryId: 1, hash: 1 }, { unique: true });
CommitSchema.index({ repositoryId: 1, committedAt: -1 });
