import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type AiConversationRole = 'user' | 'assistant';

export interface AiConversationMessageRecord {
  role: AiConversationRole;
  content: string;
  evidenceIds: string[];
  createdAt: Date;
}

@Schema({ timestamps: true, collection: 'aiConversations' })
export class AiConversation {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  ownerId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  projectId!: Types.ObjectId;

  @Prop({ type: String, required: true, default: 'Evidence conversation' })
  title!: string;

  @Prop({ type: String, required: true })
  modelName!: string;

  @Prop({ type: String, required: true })
  basis!: string;

  @Prop({
    type: [
      {
        _id: false,
        role: { type: String, enum: ['user', 'assistant'], required: true },
        content: { type: String, required: true },
        evidenceIds: [{ type: String }],
        createdAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  messages!: AiConversationMessageRecord[];

  declare createdAt: Date;
  declare updatedAt: Date;
}

export type AiConversationDocument = HydratedDocument<AiConversation>;

export const AiConversationSchema = SchemaFactory.createForClass(AiConversation);
AiConversationSchema.index({ ownerId: 1, projectId: 1, updatedAt: -1 });
