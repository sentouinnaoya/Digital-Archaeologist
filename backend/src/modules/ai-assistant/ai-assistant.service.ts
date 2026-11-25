import {
  BadGatewayException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import type { Page } from '../../common/interfaces/page.interface';
import { AiChatDto, AiConversationQueryDto } from './dto/ai-chat.dto';
import { AiConversationRepository } from './ai-conversation.repository';
import {
  buildAiEvidenceBundle,
  type AiEvidenceItem,
} from './ai-evidence.builder';
import { parseAiModelResponse } from './ai-response.parser';
import { ProjectEvidenceService } from '../evidence/project-evidence.service';
import { OllamaAdapter } from './ollama.adapter';
import { ProjectsService } from '../projects/projects.service';
import type {
  AiConversationDocument,
  AiConversationMessageRecord,
} from './schemas/ai-conversation.schema';

export interface AiStatusView {
  enabled: boolean;
  model: string;
  basis: string;
  limits: string[];
}

export interface AiMessageView {
  role: 'user' | 'assistant';
  content: string;
  evidenceIds: string[];
  createdAt: string;
}

export interface AiConversationView {
  id: string;
  projectId: string;
  title: string;
  model: string;
  basis: string;
  createdAt: string;
  updatedAt: string;
  messages: AiMessageView[];
}

export interface AiChatResult {
  conversationId: string;
  answer: string;
  evidence: AiEvidenceItem[];
  basis: string;
  limits: string[];
  model: string;
}

@Injectable()
export class AiAssistantService {
  constructor(
    private readonly config: ConfigService,
    private readonly projectsService: ProjectsService,
    private readonly evidenceService: ProjectEvidenceService,
    private readonly conversationRepository: AiConversationRepository,
    private readonly adapter: OllamaAdapter,
  ) {}

  async getStatus(ownerId: string, projectId: string): Promise<AiStatusView> {
    await this.projectsService.get(ownerId, projectId);
    const enabled = this.adapter.isEnabled();
    return {
      enabled,
      model: this.adapter.getModel(),
      basis: enabled
        ? 'The assistant is enabled and can use only the configured local Ollama endpoint.'
        : 'The assistant is disabled by default. Set AI_ENABLED=true and run a local Ollama endpoint to enable it.',
      limits: enabled
        ? [
            'Each request requires explicit consent.',
            'Only owner-scoped metadata and evidence strings are included; raw source text is never sent or executed.',
          ]
        : ['No model request is made while the assistant is disabled.'],
    };
  }

  async chat(ownerId: string, projectId: string, dto: AiChatDto): Promise<AiChatResult> {
    if (!this.adapter.isEnabled()) {
      throw new ServiceUnavailableException(
        'AI assistant is disabled. Enable AI_ENABLED and configure a local Ollama endpoint.',
      );
    }

    const evidence = await this.evidenceService.gather(ownerId, projectId);
    const bundle = buildAiEvidenceBundle({
      evidence,
      question: dto.message,
      maxItems: this.config.getOrThrow<number>('AI_MAX_EVIDENCE_ITEMS'),
    });
    const parsed = parseAiModelResponse(await this.adapter.generate(bundle.prompt));

    const validIds = new Set(bundle.items.map((item) => item.id));
    const citedIds = [...new Set(parsed.evidenceIds)].filter((id) => validIds.has(id));
    if (citedIds.length === 0) {
      throw new BadGatewayException(
        'Local model response did not cite any supplied evidence; no answer was stored',
      );
    }

    const limits = [...bundle.limits];
    const ignored = parsed.evidenceIds.filter((id) => !validIds.has(id));
    if (ignored.length > 0) {
      limits.push(`Ignored ${ignored.length} citation(s) that were not in the supplied evidence.`);
    }

    const now = new Date();
    const messages: AiConversationMessageRecord[] = [
      { role: 'user', content: dto.message, evidenceIds: [], createdAt: now },
      { role: 'assistant', content: parsed.answer, evidenceIds: citedIds, createdAt: now },
    ];
    const basis = `${bundle.basis} The answer is an interpretation grounded only in the cited evidence IDs.`;
    const owner = new Types.ObjectId(ownerId);
    const id = new Types.ObjectId(projectId);

    let conversation: AiConversationDocument | null;
    if (dto.conversationId) {
      const conversationId = new Types.ObjectId(dto.conversationId);
      const existing = await this.conversationRepository.findByIdAndOwner(conversationId, owner);
      if (!existing) throw new NotFoundException('Conversation not found');
      conversation = await this.conversationRepository.appendMessages(
        conversationId,
        owner,
        messages,
      );
      if (!conversation) throw new NotFoundException('Conversation not found');
    } else {
      conversation = await this.conversationRepository.create({
        ownerId: owner,
        projectId: id,
        title: dto.message.trim().slice(0, 60),
        modelName: this.adapter.getModel(),
        basis,
        messages,
      });
    }

    return {
      conversationId: conversation.id,
      answer: parsed.answer,
      evidence: bundle.items.filter((item) => citedIds.includes(item.id)),
      basis,
      limits,
      model: this.adapter.getModel(),
    };
  }

  async listConversations(
    ownerId: string,
    projectId: string,
    query: AiConversationQueryDto,
  ): Promise<Page<AiConversationView>> {
    await this.projectsService.get(ownerId, projectId);
    const { items, total } = await this.conversationRepository.findByProjectAndOwner(
      new Types.ObjectId(projectId),
      new Types.ObjectId(ownerId),
      (query.page - 1) * query.limit,
      query.limit,
    );
    return {
      items: items.map((item) => this.toView(item)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getConversation(
    ownerId: string,
    conversationId: string,
  ): Promise<AiConversationView> {
    const conversation = await this.conversationRepository.findByIdAndOwner(
      new Types.ObjectId(conversationId),
      new Types.ObjectId(ownerId),
    );
    if (!conversation) throw new NotFoundException('Conversation not found');
    return this.toView(conversation);
  }

  async deleteConversation(ownerId: string, conversationId: string): Promise<void> {
    const deleted = await this.conversationRepository.deleteByIdAndOwner(
      new Types.ObjectId(conversationId),
      new Types.ObjectId(ownerId),
    );
    if (!deleted) throw new NotFoundException('Conversation not found');
  }

  private toView(conversation: AiConversationDocument): AiConversationView {
    return {
      id: conversation.id,
      projectId: conversation.projectId.toString(),
      title: conversation.title,
      model: conversation.modelName,
      basis: conversation.basis,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messages: conversation.messages.map((message) => ({
        role: message.role,
        content: message.content,
        evidenceIds: message.evidenceIds,
        createdAt:
          message.createdAt instanceof Date
            ? message.createdAt.toISOString()
            : new Date(message.createdAt).toISOString(),
      })),
    };
  }
}
