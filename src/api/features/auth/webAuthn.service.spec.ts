import { MikroORM } from '@mikro-orm/core';
import { Test, TestingModule } from '@nestjs/testing';
import { VerifiedAuthenticationResponse, VerifiedRegistrationResponse, generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { MockConfigModule } from '../../testFixtures/config.mock.js';
import { CreateMikroORM } from '../../testFixtures/mikroOrm.mock.js';
import { User } from '../users/users.entity.js';
import { UserService } from '../users/users.service.js';
import { UserDevice } from './entities/userDevice.entity.js';
import { WebAuthnService } from './webAuthn.service.js';
import { Mock } from 'vitest';
import { UserRole } from '../users/userRole.enum.js';
vitest.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: vitest.fn(),
  verifyRegistrationResponse: vitest.fn(),
  generateAuthenticationOptions: vitest.fn(),
  verifyAuthenticationResponse: vitest.fn(),
}));

describe('webAuthnService', () => {
  let service: WebAuthnService;
  let module: TestingModule;
  let orm: MikroORM;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ...CreateMikroORM([UserDevice, User]),
        MockConfigModule,
      ],
      providers: [
        UserService,
        WebAuthnService,
      ],
    }).compile();

    service = module.get<WebAuthnService>(WebAuthnService);
    orm = module.get<MikroORM>(MikroORM);


    return async () => {
      await module?.close();
    };
  });

  afterEach(async () => {
    vitest.resetAllMocks();
    await orm.em.nativeDelete(UserDevice, {});
  });

  describe('registration', () => {

    it('should be able to start the registration', async () => {
      const mockUser = {
        id: 1,
        email: ''
      };

      const mockDeviceCount = 0;

      const mockDevices: UserDevice[] = [{
        id: 1,
        name: 'testDevice',
        counter: 0,
        credentialID: isoBase64URL.toBuffer('rawId2' as any),
        credentialPublicKey: 'credentialPublicKey' as any,
        transports: [],
        user: mockUser as any,
      }];

      vitest.spyOn(service, 'getDeviceCountByUserId').mockResolvedValueOnce(mockDeviceCount);
      vitest.spyOn(service, 'getDevicesByUserId').mockResolvedValueOnce(mockDevices);
      const mockChallenge = 'mockChallenge';


      (generateRegistrationOptions as Mock).mockReturnValueOnce({
        challenge: mockChallenge
      });

      await service.startWebAuthnRegistration(mockUser.id);

      expect(generateRegistrationOptions).toHaveBeenCalledTimes(1);

      const [opts] = (generateRegistrationOptions as Mock).mock.calls[0];

      expect(opts).toMatchObject({
        rpName: expect.any(String),
        rpID: expect.any(String),
        userID: expect.any(String),
        userName: expect.any(String),
        timeout: expect.any(Number),
        attestationType: expect.any(String),
        authenticatorSelection: expect.any(Object),
        excludeCredentials: expect.any(Array),
      });

      expect(opts.excludeCredentials).toHaveLength(1);
      expect(opts.excludeCredentials[0].id).toBe(mockDevices[0].credentialID);

      const { currentWebAuthnChallenge } = await orm.em.findOneOrFail(User, {
        id: mockUser.id
      });

      expect(currentWebAuthnChallenge).toBe(mockChallenge);
    });

    it('should not verify the registration if no challenge exists', async () => {
      const mockUser = {
        id: 1,
        email: ''
      };

      const user = await orm.em.findOneOrFail(User, {
        id: mockUser.id
      });

      user.currentWebAuthnChallenge = null;

      await orm.em.flush();

      const deviceName = 'testDevice';

      await expect(service.verifyWebAuthnRegistration(mockUser.id, deviceName, {
        id: 'id',
        rawId: 'rawId',
        response: {
          attestationObject: 'attestationObject',
          clientDataJSON: 'clientDataJSON',
        },
        clientExtensionResults: {},
        type: 'public-key',
      })).rejects.toThrowError('No current challenge exists');
      expect(verifyRegistrationResponse).not.toHaveBeenCalled();
    });

    it('should not verify the registration if webauthn throws an error', async () => {
      const mockUser = {
        id: 1,
        email: ''
      };

      const mockDeviceCount = 0;

      const mockDevices: UserDevice[] = [];

      vitest.spyOn(service, 'getDeviceCountByUserId').mockResolvedValueOnce(mockDeviceCount);
      vitest.spyOn(service, 'getDevicesByUserId').mockResolvedValueOnce(mockDevices);

      const user = await orm.em.findOneOrFail(User, {
        id: mockUser.id
      });
      user.currentWebAuthnChallenge = 'challenge';
      await orm.em.flush();

      (verifyRegistrationResponse as Mock).mockRejectedValueOnce(new Error('test'));

      const deviceName = 'testDevice';

      await expect(service.verifyWebAuthnRegistration(mockUser.id, deviceName, {
        id: 'id',
        rawId: 'rawId',
        response: {
          attestationObject: 'attestationObject',
          clientDataJSON: 'clientDataJSON',
        },
        clientExtensionResults: {},
        type: 'public-key',
      })).rejects.toThrowError('test');
    });

    it('should be able to verify the registration', async () => {
      const mockUser = {
        id: 1,
        email: ''
      };
      const deviceName = 'testDevice';

      const mockVerification: VerifiedRegistrationResponse = {
        verified: true,
        registrationInfo: {
          attestationObject: 'attestationObject' as any,
          credentialPublicKey: 'credentialPublicKey' as any,
          credentialID: 'credentialID' as any,
          counter: 0,
          fmt: 'fmt' as any,
        } as any,
      };

      const user = await orm.em.findOneOrFail(User, {
        id: mockUser.id
      });
      user.currentWebAuthnChallenge = 'challenge';
      await orm.em.flush();

      (verifyRegistrationResponse as Mock).mockResolvedValueOnce(mockVerification);

      await service.verifyWebAuthnRegistration(mockUser.id, deviceName, {
        id: 'id',
        rawId: 'rawId',
        response: {
          attestationObject: 'attestationObject',
          clientDataJSON: 'clientDataJSON',
        },
        clientExtensionResults: {},
        type: 'public-key',
      });

      const devices = await orm.em.find(UserDevice, {
        user: {
          id: mockUser.id
        }
      });

      expect(devices).toHaveLength(1);

      expect(devices[0].name).toBe(deviceName);

      const { currentWebAuthnChallenge } = await orm.em.findOneOrFail(User, {
        id: mockUser.id
      });

      expect(currentWebAuthnChallenge).toBeNull();
    });
  });

  describe('authentication', () => {
    it('should be able to start the authentication', async () => {
      const mockUser = {
        id: 1,
        email: ''
      };

      const mockDeviceCount = 0;

      const mockDevices: UserDevice[] = [{
        id: 1,
        name: 'testDevice',
        counter: 0,
        credentialID: isoBase64URL.toBuffer('rawId2' as any),
        credentialPublicKey: 'credentialPublicKey' as any,
        transports: [],
        user: mockUser as any,
      }];

      vitest.spyOn(service, 'getDeviceCountByUserId').mockResolvedValueOnce(mockDeviceCount);
      vitest.spyOn(service, 'getDevicesByUserId').mockResolvedValueOnce(mockDevices);
      const mockChallenge = 'mockChallenge';


      (generateAuthenticationOptions as Mock).mockReturnValueOnce({
        challenge: mockChallenge
      });

      await service.startWebAuthn(mockUser.id);

      expect(generateAuthenticationOptions).toHaveBeenCalledTimes(1);

      const [opts] = (generateAuthenticationOptions as Mock).mock.calls[0];

      expect(opts).toMatchObject({
        timeout: expect.any(Number),
        allowCredentials: expect.any(Array),
        userVerification: expect.any(String),
        rpID: expect.any(String),
      });

      expect(opts.allowCredentials).toHaveLength(1);
      expect(opts.allowCredentials[0].id).toBe(mockDevices[0].credentialID);

      const { currentWebAuthnChallenge } = await orm.em.findOneOrFail(User, {
        id: mockUser.id
      });

      expect(currentWebAuthnChallenge).toBe(mockChallenge);
    });

    it('should handle if the device does not exist', async () => {
      const mockUser = {
        id: 1,
        email: ''
      };

      orm.em.create(UserDevice, {
        id: 1,
        name: 'testDevice',
        counter: 0,
        credentialID: isoBase64URL.toBuffer('rawId' as any),
        credentialPublicKey: 'credentialPublicKey' as any,
        transports: [],
        user: mockUser as any,
      });
      const user = await orm.em.findOneOrFail(User, {
        id: mockUser.id
      });
      user.currentWebAuthnChallenge = 'challenge';
      await orm.em.flush();

      await expect(service.verifyWebAuthn(mockUser.id, {
        id: 'id',
        rawId: 'rawId2',
        response: {
          authenticatorData: 'authenticatorData',
          clientDataJSON: 'clientDataJSON',
          signature: 'signature',
          userHandle: 'userHandle',
        },
        clientExtensionResults: {},
        type: 'public-key',
      })).rejects.toThrowError('Authenticator is not registered with this site');
    });

    it('should handle login if webauthn throws an error', async () => {
      const mockUser = {
        id: 1,
        email: ''
      };

      orm.em.create(UserDevice, {
        name: 'testDevice',
        counter: 0,
        credentialID: isoBase64URL.toBuffer('rawId' as any),
        credentialPublicKey: 'credentialPublicKey' as any,
        transports: [],
        user: mockUser as any,
      });
      await orm.em.flush();
      const user = await orm.em.findOneOrFail(User, {
        id: mockUser.id
      });
      user.currentWebAuthnChallenge = 'challenge';
      await orm.em.flush();

      (verifyAuthenticationResponse as Mock).mockRejectedValueOnce(new Error('test'));

      await expect(service.verifyWebAuthn(mockUser.id, {
        id: 'id',
        rawId: 'rawId',
        response: {
          authenticatorData: 'authenticatorData',
          clientDataJSON: 'clientDataJSON',
          signature: 'signature',
          userHandle: 'userHandle',
        },
        clientExtensionResults: {},
        type: 'public-key',
      })).rejects.toThrowError('test');
    });

    it('should be able to verify the authentication', async () => {
      const mockUser = {
        id: 1,
        email: ''
      };
      const deviceName = 'testDevice';

      const mockVerification: VerifiedAuthenticationResponse = {
        verified: true,
        authenticationInfo: {
          credentialID: 'credentialID' as any,
          newCounter: 1,
        } as any,
      };
      (verifyAuthenticationResponse as Mock).mockResolvedValueOnce(mockVerification);

      // mock the device by user
      orm.em.create(UserDevice, {
        name: deviceName,
        counter: 0,
        credentialID: isoBase64URL.toBuffer('rawId' as any),
        credentialPublicKey: 'credentialPublicKey' as any,
        transports: [],
        user: mockUser as any,
      });

      await orm.em.flush();

      await service.verifyWebAuthn(mockUser.id, {
        id: 'id',
        rawId: 'rawId',
        response: {
          authenticatorData: 'authenticatorData',
          clientDataJSON: 'clientDataJSON',
          signature: 'signature',
          userHandle: 'userHandle',
        },
        clientExtensionResults: {},
        type: 'public-key',
      });

      const devices = await orm.em.find(UserDevice, {
        user: {
          id: mockUser.id
        }
      });

      expect(devices).toHaveLength(1);
      expect(devices[0].counter).toBe(1);
    });
  });

  describe('utilities', () => {
    it('should be able to get the count of devices by user id', () => {
      const mockUser = {
        id: 1,
        email: ''
      };

      const mockDeviceCount = 0;

      vitest.spyOn(service['userDeviceRepo'], 'count').mockResolvedValueOnce(mockDeviceCount);

      const result = service.getDeviceCountByUserId(mockUser.id);

      expect(result).resolves.toBe(mockDeviceCount);
    });

    it('should be able to remove a device', async () => {
      const mockUser = {
        id: 1,
        email: ''
      };

      const mockDeviceId = 5;

      // insert fake devices
      orm.em.create(UserDevice, {
        id: mockDeviceId,
        name: 'testDevice',
        counter: 0,
        credentialID: isoBase64URL.toBuffer('rawId' as any),
        credentialPublicKey: 'credentialPublicKey' as any,
        transports: [],
        user: mockUser as any,
      });

      await orm.em.flush();

      await service.removeDeviceById(mockDeviceId, mockUser.id);

      const devices = await orm.em.find(UserDevice, {
        user: {
          id: mockUser.id
        }
      });

      expect(devices).toHaveLength(0);
    });

    it('should throw an error if the device does not exist', async () => {
      const mockUser = {
        id: 1,
        email: ''
      };

      const mockDeviceId = 5;

      await expect(service.removeDeviceById(mockDeviceId, mockUser.id)).rejects.toThrowError('Device does not exist');
    });

    it('should not remove a device if it belongs to another user', async () => {
      const mockUser = {
        id: 1,
        email: ''
      };

      const extraUserId = await orm.em.insert(User, {
        email: 'test_webauth2@test.com',
        username: 'test_webauth2',
        role: UserRole.ADMIN,
        password: '',
        needPasswordReset: false,
        emailConfirmed: true
      });      
      // insert fake devices
      const fakeDevice = await orm.em.insert(UserDevice, {
        name: 'testDevice',
        counter: 0,
        credentialID: isoBase64URL.toBuffer('rawId' as any),
        credentialPublicKey: 'credentialPublicKey' as any,
        transports: [],
        user: orm.em.getReference(User, extraUserId),
      });

      await expect(service.removeDeviceById(fakeDevice, mockUser.id)).rejects.toThrowError('Device does not exist');

      await orm.em.nativeDelete(UserDevice, { id: fakeDevice });
      await orm.em.nativeDelete(User, { id: extraUserId });
    });
  });
});
