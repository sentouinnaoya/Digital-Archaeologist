import {
  BadRequestException,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { AuthService } from '../../src/modules/auth/auth.service';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { ObjectIdPipe } from '../../src/common/pipes/object-id.pipe';

function contextFor(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('security primitives', () => {
  describe('JwtAuthGuard', () => {
    const verify = jest.fn();
    const guard = new JwtAuthGuard({ verify } as unknown as JwtService);

    beforeEach(() => verify.mockReset());

    it('accepts a valid access token and attaches the user', () => {
      verify.mockReturnValue({ sub: 'user-1', email: 'user@example.com' });
      const request: Record<string, unknown> = {
        headers: { authorization: 'Bearer access-token' },
      };

      expect(guard.canActivate(contextFor(request))).toBe(true);
      expect(request.user).toEqual({ sub: 'user-1', email: 'user@example.com' });
    });

    it('rejects missing headers and refresh tokens used as bearer tokens', () => {
      expect(() => guard.canActivate(contextFor({ headers: {} }))).toThrow(
        UnauthorizedException,
      );

      verify.mockReturnValue({ sub: 'user-1', email: 'user@example.com', type: 'refresh' });
      expect(() =>
        guard.canActivate(
          contextFor({ headers: { authorization: 'Bearer refresh-token' } }),
        ),
      ).toThrow('Invalid token type');
    });

    it('rejects verification failures without leaking details', () => {
      verify.mockImplementation(() => {
        throw new Error('bad signature');
      });
      expect(() =>
        guard.canActivate(contextFor({ headers: { authorization: 'Bearer bad' } })),
      ).toThrow('Invalid or expired access token');
    });
  });

  describe('ObjectIdPipe', () => {
    const pipe = new ObjectIdPipe();

    it('passes valid ObjectIds and rejects other identifiers', () => {
      const value = '507f191e810c19729de860ea';
      expect(pipe.transform(value)).toBe(value);
      expect(() => pipe.transform('not-an-id')).toThrow(BadRequestException);
    });
  });

  describe('refresh cookie', () => {
    it('is HTTP-only, SameSite=Lax, scoped to auth and secure when configured', () => {
      const config = {
        get: (key: string) => (key === 'COOKIE_SECURE' ? 'true' : undefined),
        getOrThrow: (key: string) => {
          if (key === 'API_PREFIX') return 'api/v1';
          if (key === 'REFRESH_COOKIE_MAX_AGE_MS') return 604800000;
          throw new Error(`Missing ${key}`);
        },
      } as unknown as ConfigService;
      const service = new AuthService({} as never, {} as never, config);
      const response = { cookie: jest.fn(), clearCookie: jest.fn() };

      service.setRefreshCookie(response as never, 'refresh-token');

      expect(response.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-token',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          path: '/api/v1/auth',
          maxAge: 604800000,
        }),
      );
    });
  });
});
