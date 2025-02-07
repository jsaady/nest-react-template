import { EntityManager } from '@mikro-orm/postgresql';
import { Request } from 'express';
import { ConfigService } from '../../utils/config/config.service.js';
import { AuthService } from './auth.service.js';
import { InviteLinkService } from './inviteLink.service.js';
import { Mock } from 'vitest';



describe('InviteLinkService', () => {
  let inviteLinkService: InviteLinkService;
  let authService: Partial<Record<keyof AuthService, Mock<any, any, any>>>;
  let em: Partial<Record<keyof EntityManager, Mock<any, any, any>>>;
  let config: Partial<Record<keyof ConfigService, Mock<any, any, any>>>;

  beforeEach(() => {
    authService = {
      getCurrentUserId: vitest.fn().mockReturnValue(1),
    };
    em = {
      findOne: vitest.fn(),
      persistAndFlush: vitest.fn(),
      getReference: vitest.fn(),
      create: vitest.fn().mockImplementation((_, data) => data),
    };
    config = {
      get: vitest.fn().mockReturnValue('http://localhost:3000'),
    };
    inviteLinkService = new InviteLinkService(authService as unknown as AuthService, em as unknown as EntityManager, config as unknown as ConfigService);
  });

  describe('extractInviteCodeFromRequest', () => {
    it('should return the invite code from the request', async () => {
      const request: Request = {
        headers: {
          'x-invite-code': 'ABC123',
        },
      } as unknown as Request;

      em.findOne?.mockReturnValueOnce({
        inviteCode: 'ABC123',
      });

      const result = await inviteLinkService.extractInviteCodeFromRequest(request);

      expect(result).toMatchObject({ clientIdentifier: 'ABC123' });
    });

    it('should return null if invite code is not present in the request', async () => {
      const request: Request = {
        headers: {},
      } as unknown as Request;

      const result = await inviteLinkService.extractInviteCodeFromRequest(request);

      expect(result).toBeNull();
    });
  });

  describe('getInviteLink', () => {
    it('should return the invite link', async () => {
      const result = await inviteLinkService.getInviteLink();

      expect(result.link).toMatch(/^https?:\/\/\w+/);
    });
  });
});