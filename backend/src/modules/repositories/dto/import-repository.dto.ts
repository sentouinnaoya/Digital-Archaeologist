import {
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';

export class ImportRepositoryDto {
  @IsMongoId()
  projectId!: string;

  @IsUrl(
    {
      protocols: ['https'],
      require_protocol: true,
      require_tld: false,
      require_valid_protocol: true,
    },
    { message: 'Enter a valid HTTPS repository URL' },
  )
  @MaxLength(2048)
  repositoryUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9._/-]+$/, {
    message: 'Default branch may contain only letters, numbers, dots, underscores, slashes and hyphens',
  })
  defaultBranch?: string;
}
