import { BadGatewayException } from '@nestjs/common';

export interface ParsedAiResponse {
  answer: string;
  evidenceIds: string[];
}

export function parseAiModelResponse(raw: string): ParsedAiResponse {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new BadGatewayException('Local model did not return a valid JSON answer');
  }

  if (typeof payload !== 'object' || payload === null) {
    throw new BadGatewayException('Local model returned an unexpected answer shape');
  }

  const candidate = payload as { answer?: unknown; evidenceIds?: unknown };
  if (typeof candidate.answer !== 'string' || candidate.answer.trim().length === 0) {
    throw new BadGatewayException('Local model returned an empty answer');
  }
  if (!Array.isArray(candidate.evidenceIds)) {
    throw new BadGatewayException('Local model did not return evidence citations');
  }

  const evidenceIds = candidate.evidenceIds
    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    .map((id) => id.trim());

  return { answer: candidate.answer.trim(), evidenceIds };
}
