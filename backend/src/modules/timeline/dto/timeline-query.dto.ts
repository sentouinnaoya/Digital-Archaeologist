import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export const TIMELINE_EVENT_TYPES = [
  'commit',
  'file_added',
  'file_modified',
  'file_deleted',
  'file_renamed',
  'snapshot',
] as const;

export class TimelineQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(TIMELINE_EVENT_TYPES)
  type?: (typeof TIMELINE_EVENT_TYPES)[number];

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(254)
  contributor?: string;
}

export class StructureQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  at?: string;
}
