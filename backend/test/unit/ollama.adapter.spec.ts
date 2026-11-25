import { BadGatewayException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { OllamaAdapter } from '../../src/modules/ai-assistant/ollama.adapter';

function makeConfig(values: Record<string, unknown>): ConfigService {
  return {
    get: (key: string) => values[key],
    getOrThrow: (key: string) => {
      if (!(key in values)) throw new Error(`Missing ${key}`);
      return values[key];
    },
  } as unknown as ConfigService;
}

describe('OllamaAdapter', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('is disabled unless AI_ENABLED is exactly true', () => {
    expect(new OllamaAdapter(makeConfig({ AI_ENABLED: 'false' })).isEnabled()).toBe(false);
    expect(new OllamaAdapter(makeConfig({ AI_ENABLED: 'true' })).isEnabled()).toBe(true);
  });

  it('rejects non-local endpoints before making a request', async () => {
    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock as never;
    const adapter = new OllamaAdapter(
      makeConfig({
        AI_ENABLED: 'true',
        OLLAMA_BASE_URL: 'https://model.example.com',
        OLLAMA_MODEL: 'local-model',
        AI_TIMEOUT_MS: 1000,
      }),
    );

    await expect(adapter.generate('prompt')).rejects.toBeInstanceOf(BadGatewayException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns text from the local generate endpoint', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: '{"answer":"ok","evidenceIds":["project:1"]}' }),
    }) as never;
    const adapter = new OllamaAdapter(
      makeConfig({
        AI_ENABLED: 'true',
        OLLAMA_BASE_URL: 'http://127.0.0.1:11434',
        OLLAMA_MODEL: 'local-model',
        AI_TIMEOUT_MS: 1000,
      }),
    );

    await expect(adapter.generate('prompt')).resolves.toContain('"answer":"ok"');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/generate',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
