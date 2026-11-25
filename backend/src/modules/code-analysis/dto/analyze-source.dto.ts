import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class AnalyzeSourceDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^[0-9a-f]{4,40}$/i, { message: 'commitHash must be a Git object hash' })
  commitHash?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  refresh?: boolean;
}
