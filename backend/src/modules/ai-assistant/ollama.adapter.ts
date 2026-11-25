import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface OllamaGenerateResponse {
  response?: unknown;
}

/**
 * Deliberately local-only. External model endpoints are rejected before any
 * request is made, so enabling AI cannot silently exfiltrate project metadata.
 */
@Injectable()
export class OllamaAdapter {
  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return this.config.get('AI_ENABLED') === 'true';
  }

  getModel(): string {
    return this.config.getOrThrow<string>('OLLAMA_MODEL');
  }

  async generate(prompt: string): Promise<string> {
    const base = this.localBaseUrl();
    const model = this.getModel();
    const timeout = this.config.getOrThrow<number>('AI_TIMEOUT_MS');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${base.toString()}api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          format: 'json',
          options: { temperature: 0 },
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new BadGatewayException(`Local Ollama request failed with status ${response.status}`);
      }
      const payload = (await response.json()) as OllamaGenerateResponse;
      if (typeof payload.response !== 'string') {
        throw new BadGatewayException('Local Ollama returned no text response');
      }
      return payload.response;
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new BadGatewayException('Local Ollama request timed out');
      }
      throw new BadGatewayException('Local Ollama endpoint could not be reached');
    } finally {
      clearTimeout(timer);
    }
  }

  private localBaseUrl(): URL {
    const configured = this.config.getOrThrow<string>('OLLAMA_BASE_URL');
    let url: URL;
    try {
      url = new URL(configured);
    } catch {
      throw new BadGatewayException('OLLAMA_BASE_URL is not a valid URL');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new BadGatewayException('OLLAMA_BASE_URL must use http or https');
    }
    if (url.username || url.password) {
      throw new BadGatewayException('OLLAMA_BASE_URL must not contain credentials');
    }
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
      throw new BadGatewayException('Only a local Ollama endpoint is permitted');
    }
    if (!url.pathname.endsWith('/')) url.pathname = `${url.pathname}/`;
    return url;
  }
}
