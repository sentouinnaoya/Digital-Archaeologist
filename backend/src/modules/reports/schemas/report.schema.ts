import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'reports' })
export class Report {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  ownerId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  projectId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  title!: string;

  @Prop({ type: String, required: true, default: 'markdown' })
  format!: string;

  @Prop({ type: String, required: true })
  content!: string;

  @Prop({ type: String, required: true })
  basis!: string;

  @Prop({ type: [String], default: [] })
  evidenceIds!: string[];

  @Prop({ type: [String], default: [] })
  limits!: string[];

  declare createdAt: Date;
  declare updatedAt: Date;
}

export type ReportDocument = HydratedDocument<Report>;

export const ReportSchema = SchemaFactory.createForClass(Report);
ReportSchema.index({ ownerId: 1, projectId: 1, createdAt: -1 });
