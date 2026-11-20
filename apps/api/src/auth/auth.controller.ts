import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthenticatedRequest } from './auth.types';
import { Req } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) { return this.auth.login(dto); }

  @Post('refresh')
  refresh(@Body('refreshToken') refreshToken: string) { return this.auth.refresh(refreshToken); }

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  mfaSetup(@Req() request: AuthenticatedRequest) { return this.auth.setupMfa(request.user.id); }

  @Post('mfa/confirm')
  @UseGuards(JwtAuthGuard)
  mfaConfirm(@Body('code') code: string, @Req() request: AuthenticatedRequest) { return this.auth.confirmMfa(request.user.id, code); }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  mfaDisable(@Body('code') code: string, @Req() request: AuthenticatedRequest) { return this.auth.disableMfa(request.user.id, code); }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() request: AuthenticatedRequest) { return request.user; }

  @Get('permissions/check')
  @UseGuards(JwtAuthGuard)
  async checkPermission(@Req() request: AuthenticatedRequest, @Query('code') code: string) {
    return { code, allowed: Boolean(code) && request.user.permissions.includes(code) };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@Req() request: AuthenticatedRequest) { return this.auth.logout(request.user.id); }
}
