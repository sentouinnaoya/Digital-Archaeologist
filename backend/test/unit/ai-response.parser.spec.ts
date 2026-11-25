import { BadGatewayException } from '@nestjs/common';
import { parseAiModelResponse } from '../../src/modules/ai-assistant/ai-response.parser';

describe('parseAiModelResponse', () => {
  it('accepts a cited JSON answer', () => {
    const parsed = parseAiModelResponse(
      JSON.stringify({ answer: 'Observed metadata only.', evidenceIds: ['project:1', '  '] }),
    );

    expect(parsed).toEqual({ answer: 'Observed metadata only.', evidenceIds: ['project:1'] });
  });

  it.each([
    'not json',
    '{}',
    JSON.stringify({ answer: '', evidenceIds: ['project:1'] }),
    JSON.stringify({ answer: 'ok', evidenceIds: 'project:1' }),
  ])('rejects an ungrounded or malformed response', (raw) => {
    expect(() => parseAiModelResponse(raw)).toThrow(BadGatewayException);
  });
});
