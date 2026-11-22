import type { CommitFileChange } from './schemas/commit.schema';

export interface ParsedGitCommit {
  hash: string;
  authorName: string;
  authorEmail: string;
  authoredAt: string;
  committedAt: string;
  parentHashes: string[];
  message: string;
  fileChanges: CommitFileChange[];
}

const RECORD_SEPARATOR = '\x1e';
const FIELD_SEPARATOR = '\x1f';
const STATUS_LINE = /^([A-Z])\t(.+)$/;

export function parseGitLog(rawOutput: string): ParsedGitCommit[] {
  return rawOutput
    .split(RECORD_SEPARATOR)
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const lines = record.split('\n');
      const header = lines.shift() ?? '';
      const fields = header.split(FIELD_SEPARATOR);
      if (fields.length < 7) {
        throw new Error('Unexpected git log format');
      }

      const [hash, authorName, authorEmail, authoredAt, committedAt, parents, ...messageParts] =
        fields;
      const statusIndex = lines.findIndex((line) => STATUS_LINE.test(line));
      const messageLines =
        statusIndex === -1 ? lines : lines.slice(0, statusIndex);
      const message = [...messageParts, ...messageLines]
        .join('\n')
        .replace(/\n+$/, '');

      const fileChanges: CommitFileChange[] = [];
      if (statusIndex !== -1) {
        for (const line of lines.slice(statusIndex)) {
          const match = STATUS_LINE.exec(line);
          if (match) {
            fileChanges.push({ status: match[1], path: match[2] });
          }
        }
      }

      return {
        hash,
        authorName,
        authorEmail,
        authoredAt,
        committedAt,
        parentHashes: parents ? parents.split(' ').filter(Boolean) : [],
        message,
        fileChanges,
      };
    });
}
