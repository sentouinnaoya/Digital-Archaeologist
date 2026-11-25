import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EvidenceModule } from '../evidence/evidence.module';
import { ProjectsModule } from '../projects/projects.module';
import { AiAssistantController } from './ai-assistant.controller';
import { AiAssistantService } from './ai-assistant.service';
import { AiConversationRepository } from './ai-conversation.repository';
import { OllamaAdapter } from './ollama.adapter';
import {
  AiConversation,
  AiConversationSchema,
} from './schemas/ai-conversation.schema';

@Module({
  imports: [
    ProjectsModule,
    EvidenceModule,
    MongooseModule.forFeature([
      { name: AiConversation.name, schema: AiConversationSchema },
    ]),
  ],
  controllers: [AiAssistantController],
  providers: [AiConversationRepository, OllamaAdapter, AiAssistantService],
  exports: [AiAssistantService],
})
export class AiAssistantModule {}
