import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import type {
  SourceImport,
  SourceModule,
  SourceSymbol,
  SourceSyntaxError,
  SourceFileStatus,
  SourceParserKind,
} from '../source-parser';

@Schema({ timestamps: true, collection: 'analysisSnapshots' })
export class AnalysisSnapshot {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  repositoryId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  projectId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  ownerId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  sourceType!: 'git_url' | 'zip';

  @Prop({ type: String, required: true })
  commitHash!: string;

  @Prop({ type: String, required: true })
  analyzerVersion!: string;

  @Prop({
    type: [
      {
        path: String,
        language: String,
        parser: String,
        status: String,
        size: Number,
        symbols: [{ name: String, kind: String, startLine: Number, endLine: Number, _id: false }],
        imports: [
          {
            source: String,
            kind: String,
            names: [String],
            line: Number,
            _id: false,
          },
        ],
        modules: [{ name: String, kind: String, path: String, _id: false }],
        syntaxErrors: [
          { message: String, line: Number, column: Number, _id: false },
        ],
        truncated: Boolean,
        _id: false,
      },
    ],
    default: [],
  })
  files!: ParsedSourceFileRecord[];

  @Prop({ type: Object, required: true })
  summary!: SourceSummary;

  declare createdAt: Date;
  declare updatedAt: Date;
}

export interface ParsedSourceFileRecord {
  path: string;
  language: string | null;
  parser: SourceParserKind;
  status: SourceFileStatus;
  size: number;
  symbols: SourceSymbol[];
  imports: SourceImport[];
  modules: SourceModule[];
  syntaxErrors: SourceSyntaxError[];
  truncated: boolean;
}

export interface SourceSummary {
  fileCount: number;
  parsedCount: number;
  syntaxErrorCount: number;
  unsupportedCount: number;
  failedCount: number;
  symbolCount: number;
  importCount: number;
  fileLimitApplied: boolean;
}

export type AnalysisSnapshotDocument = HydratedDocument<AnalysisSnapshot>;
export const AnalysisSnapshotSchema = SchemaFactory.createForClass(AnalysisSnapshot);
AnalysisSnapshotSchema.index(
  { repositoryId: 1, commitHash: 1, analyzerVersion: 1 },
  { unique: true },
);
AnalysisSnapshotSchema.index({ ownerId: 1, projectId: 1, createdAt: -1 });
