import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException, UseGuards, applyDecorators } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { CONFIG_VARS, MFA_ENABLED } from '../../utils/config/config.js';
import { AuthDTO, AuthTokenContents } from './auth.dto.js';
import { ConfigService } from '../../utils/config/config.service.js';
const IS_AUTH_CONFIG = 'IS_AUTH_CONFIG';
const SKIP_AUTH_CHECK = 'SKIP_AUTH_CHECK';

export interface IsAuthenticatedConfig {
  allowExpiredPassword?: boolean;
  allowUnverifiedEmail?: boolean;
  allowNoMFA?: boolean;
}

@Injectable()
export class IsAuthenticatedGuard implements CanActivate {
  constructor (
    private jwt: JwtService,
    private reflector: Reflector,
    private configService: ConfigService
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();
    const skipAuthCheck = this.reflector.getAllAndOverride(SKIP_AUTH_CHECK, [context.getClass(), context.getHandler()]) ?? false;

    if (skipAuthCheck) return true;

    const { allowExpiredPassword = false, allowUnverifiedEmail = false, allowNoMFA = false } = this.reflector.getAllAndOverride<IsAuthenticatedConfig>(IS_AUTH_CONFIG, [context.getClass(), context.getHandler()]) ?? false;

    const token = this.extractTokenFromCookie(request);
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      const payload = await this.jwt.verifyAsync<AuthTokenContents>(
        token.token,
        {
          secret: this.configService.getOrThrow('jwtSecret')
        }
      );

      // 💡 We're assigning the payload to the request object here
      // so that we can access it in our route handlers
      request.user = payload;

      if (!allowExpiredPassword && payload.needPasswordReset) {
        return false;
      }

      if (!allowUnverifiedEmail && !payload.emailConfirmed) {
        return false;
      }

      if (MFA_ENABLED && !allowNoMFA && (!payload.mfaEnabled || !payload.mfaMethod)) {
        return false;
      }
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }

  private extractTokenFromCookie(request: Request): AuthDTO | undefined {
    const rawToken = request.signedCookies['Authorization'];

    if (rawToken) {
      const serializedToken = Buffer.from(rawToken, 'base64').toString('utf-8');

      const parsedToken = JSON.parse(serializedToken);

      return parsedToken;
    }
  }
}

export const IsAuthenticated = (c: IsAuthenticatedConfig = { allowExpiredPassword: false, allowUnverifiedEmail: false }) => applyDecorators(UseGuards(IsAuthenticatedGuard), SetMetadata(IS_AUTH_CONFIG, c));
export const AllowUnauthenticated = () => SetMetadata(SKIP_AUTH_CHECK, true);
