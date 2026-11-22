import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  repositoryUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  defaultBranch?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  primaryLanguage?: string;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  repositoryUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9._/-]+$/)
  defaultBranch?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  primaryLanguage?: string;
}
