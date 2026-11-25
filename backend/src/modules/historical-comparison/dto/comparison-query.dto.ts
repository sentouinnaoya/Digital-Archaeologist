import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const COMMIT_HASH = /^[0-9a-f]{4,40}$/i;

export class ProjectComparisonQueryDto {
  @IsString()
  @MaxLength(40)
  @Matches(COMMIT_HASH, { message: 'from must be a Git object hash' })
  from!: string;

  @IsString()
  @MaxLength(40)
  @Matches(COMMIT_HASH, { message: 'to must be a Git object hash' })
  to!: string;
}

export class RepositoryComparisonQueryDto {
  @IsString()
  @MaxLength(40)
  @Matches(COMMIT_HASH, { message: 'fromCommit must be a Git object hash' })
  fromCommit!: string;

  @IsString()
  @MaxLength(40)
  @Matches(COMMIT_HASH, { message: 'toCommit must be a Git object hash' })
  toCommit!: string;
}

export class ProjectFileComparisonQueryDto extends ProjectComparisonQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  @Matches(/^[^\0]+$/, { message: 'path must not contain NUL characters' })
  path!: string;
}

export class RepositoryFileComparisonQueryDto extends RepositoryComparisonQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  @Matches(/^[^\0]+$/, { message: 'path must not contain NUL characters' })
  path!: string;
}
