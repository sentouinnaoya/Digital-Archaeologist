import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import type { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface PublicUser {
  id: string;
  fullName: string;
  email: string;
  createdAt: Date;
}

export interface IssuedTokens {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

interface RefreshPayload {
  sub: string;
  type: string;
  jti: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<IssuedTokens> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create({
      fullName: dto.fullName.trim(),
      email,
      passwordHash,
    });

    return this.issueTokens(user);
  }

  async login(dto: LoginDto): Promise<IssuedTokens> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<IssuedTokens> {
    let payload: RefreshPayload;
    try {
      payload = this.jwtService.verify<RefreshPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh' || !payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findById(payload.sub);
    if (
      !user?.refreshTokenHash ||
      !(await bcrypt.compare(refreshToken, user.refreshTokenHash))
    ) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    // Rotation: the old token is replaced immediately.
    return this.issueTokens(user);
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.setRefreshTokenHash(userId, null);
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Account no longer exists');
    }
    return this.toPublicUser(user);
  }

  setRefreshCookie(response: Response, refreshToken: string): void {
    const prefix = this.config.getOrThrow<string>('API_PREFIX');
    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: this.config.get('COOKIE_SECURE') === 'true',
      sameSite: 'lax',
      path: `/${prefix}/auth`,
      maxAge: this.config.getOrThrow<number>('REFRESH_COOKIE_MAX_AGE_MS'),
    });
  }

  clearRefreshCookie(response: Response): void {
    const prefix = this.config.getOrThrow<string>('API_PREFIX');
    response.clearCookie('refresh_token', {
      httpOnly: true,
      sameSite: 'lax',
      path: `/${prefix}/auth`,
    });
  }

  private async issueTokens(user: UserDocument): Promise<IssuedTokens> {
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });

    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh', jti: randomUUID() },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.getOrThrow<number>('JWT_REFRESH_TTL_SECONDS'),
      },
    );

    await this.usersService.setRefreshTokenHash(
      user.id,
      await bcrypt.hash(refreshToken, 10),
    );

    return { user: this.toPublicUser(user), accessToken, refreshToken };
  }

  private toPublicUser(user: UserDocument): PublicUser {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      createdAt: user.createdAt,
    };
  }
}
