import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { AccessTokenPayload, AuthenticatedUser } from './auth.types';
import { PasswordService } from './password.service';

const userInclude = {
  roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly passwords: PasswordService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ username: dto.identifier }, { email: dto.identifier }] },
      include: userInclude,
    });

    if (!user || !user.isActive || !(await this.passwords.verify(dto.password, user.passwordHash))) {
      await this.writeAudit('LOGIN_FAILED', null, { identifier: dto.identifier });
      throw new UnauthorizedException('Invalid credentials');
    }
    if (this.isPrivileged(user) && user.mfaEnabled) {
      if (!dto.mfaCode || !this.verifyTotp(user.mfaSecret, dto.mfaCode)) {
        await this.writeAudit('LOGIN_MFA_FAILED', user.id, { username: user.username });
        throw new UnauthorizedException('A valid MFA code is required');
      }
    }

    const currentUser = this.toAuthenticatedUser(user);
    const tokens = await this.issueTokens(user.id, user.username, user.sessionVersion);
    await this.writeAudit('LOGIN_SUCCEEDED', user.id, { username: user.username });

    return { ...tokens, tokenType: 'Bearer', user: currentUser };
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!stored || stored.revokedAt || stored.expiresAt <= new Date() || !stored.user.isActive) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokens = await this.issueTokens(stored.user.id, stored.user.username, stored.user.sessionVersion);
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date(), replacedBy: tokens.refreshTokenId } });
    const user = await this.getCurrentUser(stored.user.id);
    await this.writeAudit('TOKEN_REFRESHED', stored.user.id, { username: stored.user.username });
    return { ...tokens, tokenType: 'Bearer', user };
  }

  async logout(userId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
      await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditEvent.create({ data: { actorId: userId, action: 'LOGOUT', entityType: 'AUTHENTICATION', metadata: {} } });
    });
    return { success: true };
  }

  async getCurrentUser(userId: string, expectedSessionVersion?: number): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: userInclude });
    if (!user || !user.isActive) throw new UnauthorizedException('User is inactive or unavailable');
    if (expectedSessionVersion !== undefined && user.sessionVersion !== expectedSessionVersion) {
      throw new UnauthorizedException('Session has been revoked');
    }
    return this.toAuthenticatedUser(user);
  }

  async hasPermissions(userId: string, required: string[]): Promise<boolean> {
    if (!required.length) return true;
    const user = await this.getCurrentUser(userId);
    return required.every((permission) => user.permissions.includes(permission));
  }

  async setupMfa(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User is inactive or unavailable');
    const secret = this.base32Encode(randomBytes(20));
    await this.prisma.user.update({ where: { id: userId }, data: { mfaSecret: secret, mfaEnabled: false } });
    return {
      secret,
      issuer: 'Gateway Motors DMS',
      account: user.email,
      otpauth: `otpauth://totp/Gateway%20Motors%20DMS:${encodeURIComponent(user.email)}?secret=${secret}&issuer=Gateway%20Motors%20DMS`,
    };
  }

  async confirmMfa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret || !this.verifyTotp(user.mfaSecret, code)) throw new UnauthorizedException('Invalid MFA code');
    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
    await this.writeAudit('MFA_ENABLED', userId, { username: user.username });
    return { enabled: true };
  }

  async disableMfa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret || !this.verifyTotp(user.mfaSecret, code)) throw new UnauthorizedException('Invalid MFA code');
    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: false, mfaSecret: null } });
    await this.writeAudit('MFA_DISABLED', userId, { username: user.username });
    return { enabled: false };
  }

  private toAuthenticatedUser(user: any): AuthenticatedUser {
    const roles = user.roles.map((userRole: any) => userRole.role);
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      isActive: user.isActive,
      roles: roles.map((role: any) => role.name),
      permissions: Array.from(new Set<string>(roles.flatMap((role: any) => role.permissions.map((entry: any) => entry.permission.code as string)))),
    };
  }

  private async writeAudit(action: string, actorId: string | null, metadata: Record<string, string>) {
    try {
      await this.prisma.auditEvent.create({ data: { action, entityType: 'AUTHENTICATION', actorId, metadata } });
    } catch {
      // Authentication must not fail solely because audit persistence is unavailable.
    }
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private isPrivileged(user: any) {
    return user.roles?.some((entry: any) => ['Director / Managing Director', 'System Administrator', 'Accounts Manager'].includes(entry.role?.name));
  }

  private base32Encode(value: Buffer) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let buffer = 0;
    let output = '';
    for (const byte of value) {
      buffer = (buffer << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        output += alphabet[(buffer >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) output += alphabet[(buffer << (5 - bits)) & 31];
    return output;
  }

  private base32Decode(value: string) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let buffer = 0;
    const output: number[] = [];
    for (const char of value.replace(/=+$/, '').toUpperCase()) {
      const index = alphabet.indexOf(char);
      if (index < 0) return Buffer.alloc(0);
      buffer = (buffer << 5) | index;
      bits += 5;
      if (bits >= 8) {
        output.push((buffer >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    return Buffer.from(output);
  }

  private totp(secret: string, counter: number) {
    const key = this.base32Decode(secret);
    const message = Buffer.alloc(8);
    message.writeBigUInt64BE(BigInt(counter));
    const digest = createHmac('sha1', key).update(message).digest();
    const offset = digest[digest.length - 1] & 15;
    const binary = ((digest[offset] & 127) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
    return String(binary % 1_000_000).padStart(6, '0');
  }

  private verifyTotp(secret: string | null | undefined, code: string) {
    if (!secret || !/^\d{6}$/.test(code)) return false;
    const counter = Math.floor(Date.now() / 1000 / 30);
    return [counter - 1, counter, counter + 1].some((candidate) => this.totp(secret, candidate) === code);
  }

  private async issueTokens(userId: string, username: string, sessionVersion: number) {
    const payload: AccessTokenPayload = { sub: userId, username, sessionVersion };
    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = randomBytes(48).toString('hex');
    const refreshDays = Math.max(1, Number(process.env.JWT_REFRESH_EXPIRES_IN_DAYS ?? 30));
    const stored = await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000),
      },
    });
    return { accessToken, refreshToken, refreshTokenId: stored.id };
  }
}
