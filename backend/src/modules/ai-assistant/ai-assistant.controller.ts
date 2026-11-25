import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ObjectIdPipe } from '../../common/pipes/object-id.pipe';
import { AiAssistantService } from './ai-assistant.service';
import { AiChatDto, AiConversationQueryDto } from './dto/ai-chat.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class AiAssistantController {
  constructor(private readonly assistant: AiAssistantService) {}

  @Get('projects/:projectId/ai/status')
  status(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ObjectIdPipe) projectId: string,
  ) {
    return this.assistant.getStatus(user.sub, projectId);
  }

  @Get('projects/:projectId/ai/conversations')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ObjectIdPipe) projectId: string,
    @Query() query: AiConversationQueryDto,
  ) {
    return this.assistant.listConversations(user.sub, projectId, query);
  }

  @Get('ai/conversations/:conversationId')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ObjectIdPipe) conversationId: string,
  ) {
    return this.assistant.getConversation(user.sub, conversationId);
  }

  @Post('projects/:projectId/ai/chat')
  chat(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ObjectIdPipe) projectId: string,
    @Body() dto: AiChatDto,
  ) {
    return this.assistant.chat(user.sub, projectId, dto);
  }

  @Delete('ai/conversations/:conversationId')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ObjectIdPipe) conversationId: string,
  ) {
    return this.assistant.deleteConversation(user.sub, conversationId);
  }
}
