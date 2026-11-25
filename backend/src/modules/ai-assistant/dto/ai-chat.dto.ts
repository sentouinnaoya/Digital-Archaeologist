import {
  IsBoolean,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class AiChatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsMongoId()
  conversationId?: string;

  @IsBoolean()
  @IsIn([true], {
    message: 'Explicit consent is required before project evidence is sent to the model',
  })
  consent!: boolean;
}

export class AiConversationQueryDto extends PaginationQueryDto {}
