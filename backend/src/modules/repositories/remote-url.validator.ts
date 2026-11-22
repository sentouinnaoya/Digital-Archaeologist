import { Injectable } from '@nestjs/common';
import { resolveSafeRemoteUrl } from './git-url.util';

@Injectable()
export class RemoteUrlValidator {
  async validate(rawUrl: string): Promise<string> {
    return resolveSafeRemoteUrl(rawUrl);
  }
}
