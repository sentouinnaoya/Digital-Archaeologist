import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'snapshotFiles' })
export class SnapshotFile {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Repository',
    required: true,
    index: true,
  })
  repositoryId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  ownerId!: Types.ObjectId;

  @Prop({ required: true })
  path!: string;

  @Prop({ type: Number, required: true })
  size!: number;

  @Prop({ type: String, default: null })
  extension!: string | null;

  @Prop({ type: String, default: null })
  language!: string | null;

  declare createdAt: Date;
  declare updatedAt: Date;
}

export type SnapshotFileDocument = HydratedDocument<SnapshotFile>;
export const SnapshotFileSchema = SchemaFactory.createForClass(SnapshotFile);
SnapshotFileSchema.index({ repositoryId: 1, path: 1 }, { unique: true });
SnapshotFileSchema.index({ repositoryId: 1, language: 1 });
