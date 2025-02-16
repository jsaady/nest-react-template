import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CheckRoleGuard } from './checkRole.js';
import { Mock } from 'vitest';

describe('CheckRoleGuard', () => {
  let guard: CheckRoleGuard;
  let reflector: Record<keyof Reflector, Mock<any, any, any>>;

  beforeEach(() => {
    reflector = {
      getAllAndMerge: vitest.fn(),
      get: vitest.fn(),
      getAll: vitest.fn(),
      getAllAndOverride: vitest.fn(),
    };
    guard = new CheckRoleGuard(reflector as Reflector);
  });

  it('should return false if no user is present', () => {
    const context: ExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: null,
        }),
      }),
      getHandler: () => {},
      getClass: () => {},
    } as ExecutionContext;

    const canActivate = guard.canActivate(context);

    expect(canActivate).toBe(false);
  });

  it('should return true if no roles are required', () => {
    const context: ExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            role: 'admin',
          },
        }),
      }),
      getHandler: () => {},
      getClass: () => {},
    } as ExecutionContext;

    reflector.getAllAndMerge?.mockReturnValueOnce(null);

    const canActivate = guard.canActivate(context);

    expect(canActivate).toBe(true);
  });

  it('should return true if user has the role', () => {
    const context: ExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            role: 'admin',
          },
        }),
      }),
      getHandler: () => {},
      getClass: () => {},
    } as ExecutionContext;

    reflector.getAllAndMerge?.mockReturnValueOnce([['admin']]);

    const canActivate = guard.canActivate(context);

    expect(canActivate).toBe(true);
  });

  it('should return true if user has at least one required role', () => {
    const context: ExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            role: 'user',
          },
        }),
      }),
      getHandler: () => {},
      getClass: () => {},
    } as ExecutionContext;

    reflector.getAllAndMerge?.mockReturnValueOnce([['admin'], ['user']]);

    const canActivate = guard.canActivate(context);

    expect(canActivate).toBe(true);
  });

  it('should return false if user does not have any required role', () => {
    const context: ExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            role: 'guest',
          },
        }),
      }),
      getHandler: () => {},
      getClass: () => {},
    } as ExecutionContext;

    reflector.getAllAndMerge?.mockReturnValueOnce([['admin'], ['user']]);

    const canActivate = guard.canActivate(context);

    expect(canActivate).toBe(false);
  });
});