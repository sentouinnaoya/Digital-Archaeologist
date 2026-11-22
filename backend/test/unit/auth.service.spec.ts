import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { UserDocument } from '../../src/modules/users/schemas/user.schema';
import { UsersService } from '../../src/modules/users/users.service';
import { AuthService } from '../../src/modules/auth/auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<Pick<UsersService, 'findByEmail' | 'create' | 'findById' | 'setRefreshTokenHash'>>;
  let jwtService: jest.Mocked<Pick<JwtService, 'sign' | 'verify'>>;

  const makeUser = (overrides: Partial<UserDocument> = {}): UserDocument =>
    ({
      id: 'user-1',
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      passwordHash: '',
      refreshTokenHash: null,
      createdAt: new Date('2025-01-01T00:00:00Z'),
      ...overrides,
    }) as unknown as UserDocument;

  beforeEach(() => {
    usersService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      setRefreshTokenHash: jest.fn(),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('signed-token'),
      verify: jest.fn(),
    };
    const config = {
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, unknown> = {
          JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-long-enough',
          JWT_REFRESH_TTL_SECONDS: 604800,
          REFRESH_COOKIE_MAX_AGE_MS: 604800000,
          API_PREFIX: 'api/v1',
        };
        return values[key];
      }),
      get: jest.fn(() => 'false'),
    } as unknown as ConfigService;

    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
      config,
    );
  });

  it('hashes the password, creates the user and stores only a refresh token hash', async () => {
    usersService.findByEmail.mockResolvedValue(null);
    usersService.create.mockImplementation(async (input) =>
      makeUser({ passwordHash: input.passwordHash }),
    );

    const result = await service.register({
      fullName: '  Ada Lovelace  ',
      email: '  ADA@Example.com ',
      password: 'analytical1',
    });

    const created = usersService.create.mock.calls[0][0];
    expect(created.email).toBe('ada@example.com');
    expect(created.fullName).toBe('Ada Lovelace');
    expect(created.passwordHash).not.toBe('analytical1');
    expect(await bcrypt.compare('analytical1', created.passwordHash)).toBe(true);
    expect(result.user.email).toBe('ada@example.com');
    expect(result.accessToken).toBe('signed-token');
    expect(jwtService.sign).toHaveBeenCalledTimes(2);
    const storedHash = usersService.setRefreshTokenHash.mock.calls[0][1];
    expect(storedHash).not.toBe('signed-token');
    expect(await bcrypt.compare('signed-token', storedHash as string)).toBe(true);
  });

  it('rejects registration with an existing email', async () => {
    usersService.findByEmail.mockResolvedValue(makeUser());
    await expect(
      service.register({ fullName: 'Ada', email: 'ada@example.com', password: 'analytical1' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(usersService.create).not.toHaveBeenCalled();
  });

  it('rejects a wrong password without issuing tokens', async () => {
    usersService.findByEmail.mockResolvedValue(
      makeUser({ passwordHash: bcrypt.hashSync('correct1', 10) }),
    );
    await expect(
      service.login({ email: 'ada@example.com', password: 'wrong1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtService.sign).not.toHaveBeenCalled();
  });

  it('rotates a valid refresh token', async () => {
    const oldToken = 'old-refresh-token';
    jwtService.verify.mockReturnValue({ sub: 'user-1', type: 'refresh', jti: 'x' });
    usersService.findById.mockResolvedValue(
      makeUser({ refreshTokenHash: bcrypt.hashSync(oldToken, 10) }),
    );

    const result = await service.refresh(oldToken);

    expect(result.accessToken).toBe('signed-token');
    expect(usersService.setRefreshTokenHash).toHaveBeenCalledTimes(1);
    expect(jwtService.sign).toHaveBeenCalledTimes(2);
  });

  it('rejects a revoked refresh token', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-1', type: 'refresh', jti: 'x' });
    usersService.findById.mockResolvedValue(makeUser({ refreshTokenHash: null }));

    await expect(service.refresh('old-refresh-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwtService.sign).not.toHaveBeenCalled();
  });
});
