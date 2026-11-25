import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AiConversation,
  AiConversationDocument,
  AiConversationMessageRecord,
} from './schemas/ai-conversation.schema';

export interface AiConversationCreateInput {
  ownerId: Types.ObjectId;
  projectId: Types.ObjectId;
  title: string;
  modelName: string;
  basis: string;
  messages: AiConversationMessageRecord[];
}

@Injectable()
export class AiConversationRepository {
  constructor(
    @InjectModel(AiConversation.name)
    private readonly model: Model<AiConversationDocument>,
  ) {}

  create(input: AiConversationCreateInput): Promise<AiConversationDocument> {
    return this.model.create(input);
  }

  async findByProjectAndOwner(
    projectId: Types.ObjectId,
    ownerId: Types.ObjectId,
    skip: number,
    limit: number,
  ): Promise<{ items: AiConversationDocument[]; total: number }> {
    const [items, total] = await Promise.all([
      this.model
        .find({ projectId, ownerId })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.model.countDocuments({ projectId, ownerId }).exec(),
    ]);
    return { items, total };
  }

  findByIdAndOwner(
    conversationId: Types.ObjectId,
    ownerId: Types.ObjectId,
  ): Promise<AiConversationDocument | null> {
    return this.model.findOne({ _id: conversationId, ownerId }).exec();
  }

  async appendMessages(
    conversationId: Types.ObjectId,
    ownerId: Types.ObjectId,
    messages: AiConversationMessageRecord[],
  ): Promise<AiConversationDocument | null> {
    return this.model
      .findOneAndUpdate(
        { _id: conversationId, ownerId },
        { $push: { messages: { $each: messages } } },
        { returnDocument: 'after' },
      )
      .exec();
  }

  async deleteByIdAndOwner(
    conversationId: Types.ObjectId,
    ownerId: Types.ObjectId,
  ): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: conversationId, ownerId }).exec();
    return result.deletedCount === 1;
  }
}
