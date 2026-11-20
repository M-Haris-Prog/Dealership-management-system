export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  isActive: boolean;
  roles: string[];
  permissions: string[];
}

export interface AccessTokenPayload {
  sub: string;
  username: string;
  sessionVersion: number;
}

import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
