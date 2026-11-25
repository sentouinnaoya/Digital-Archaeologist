import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const COMMIT_KEY = /^(snapshot|[0-9a-f]{4,40})$/i;

export class ArchitectureQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(COMMIT_KEY, { message: 'commitHash must be a Git object hash or snapshot' })
  commitHash?: string;
}

export class ArchitectureCompareDto {
  @IsString()
  @MaxLength(40)
  @Matches(COMMIT_KEY, { message: 'from must be a Git object hash or snapshot' })
  from!: string;

  @IsString()
  @MaxLength(40)
  @Matches(COMMIT_KEY, { message: 'to must be a Git object hash or snapshot' })
  to!: string;
}
