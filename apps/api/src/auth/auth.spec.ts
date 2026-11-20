import 'reflect-metadata';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { PasswordService } from './password.service';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSIONS_KEY } from './auth.constants';

describe('authentication and permissions', () => {
  it('hashes passwords and rejects wrong or malformed passwords', async () => {
    const service = new PasswordService();
    const hash = await service.hash('correct horse battery staple');
    expect(await service.verify('correct horse battery staple', hash)).toBe(true);
    expect(await service.verify('wrong password', hash)).toBe(false);
    expect(await service.verify('anything', 'not-a-password-hash')).toBe(false);
  });

  it('allows public handlers and requires every declared permission', () => {
    const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const request = { user: { permissions: ['reporting.read', 'inventory.stock.issue'] } };
    const context = { getHandler: jest.fn(), getClass: jest.fn(), switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;

    reflector.getAllAndOverride = jest.fn().mockReturnValue([]);
    expect(guard.canActivate(context)).toBe(true);
    reflector.getAllAndOverride = jest.fn().mockReturnValue(['reporting.read', 'inventory.stock.issue']);
    expect(guard.canActivate(context)).toBe(true);
    reflector.getAllAndOverride = jest.fn().mockReturnValue(['reporting.read', 'finance.journal.post']);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('exposes the permission check endpoint through the authenticated controller', async () => {
    const controller = new AuthController({} as any);
    expect(await controller.checkPermission({ user: { permissions: ['users.manage'] } } as any, 'users.manage')).toEqual({ code: 'users.manage', allowed: true });
    expect(await controller.checkPermission({ user: { permissions: [] } } as any, 'users.manage')).toEqual({ code: 'users.manage', allowed: false });
    expect(Reflect.getMetadata('__guards__', AuthController.prototype.me)).toBeDefined();
    expect(Reflect.getMetadata(PERMISSIONS_KEY, AuthController.prototype.me)).toBeUndefined();
  });
});
