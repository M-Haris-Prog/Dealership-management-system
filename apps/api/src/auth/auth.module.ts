import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PasswordService } from './password.service';
import { PermissionsGuard } from './permissions.guard';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_ACCESS_SECRET;
        if (!secret) throw new Error('JWT_ACCESS_SECRET must be configured');
        return { secret, signOptions: { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m' } };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, JwtAuthGuard, PermissionsGuard],
  exports: [AuthService, PasswordService, JwtAuthGuard, PermissionsGuard, JwtModule],
})
export class AuthModule {}
