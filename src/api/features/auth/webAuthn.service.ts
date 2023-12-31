import { EntityRepository } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { BadRequestException, Injectable } from '@nestjs/common';
import { GenerateAuthenticationOptionsOpts, GenerateRegistrationOptionsOpts, VerifiedAuthenticationResponse, VerifiedRegistrationResponse, VerifyAuthenticationResponseOpts, VerifyRegistrationResponseOpts, generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server';
import { isoBase64URL, isoUint8Array } from '@simplewebauthn/server/helpers';
import { AuthenticationResponseJSON, AuthenticatorDevice, RegistrationResponseJSON } from '@simplewebauthn/typescript-types';
import { APP_NAME } from '../../utils/config/config.js';
import { ConfigService } from '../../utils/config/config.service.js';
import { UserService } from '../users/users.service.js';
import { UserDevice } from './entities/userDevice.entity.js';

@Injectable()
export class WebAuthnService {

  private readonly rpName: string;
  private readonly rpId: string;

  constructor (
    private userService: UserService,
    @InjectRepository(UserDevice) private userDeviceRepo: EntityRepository<UserDevice>,
    private configService: ConfigService
  ) {
    this.rpName = `${APP_NAME} - ${configService.getOrThrow('envName')}`;
    this.rpId = new URL(configService.getOrThrow('envUrl')).hostname;
  }

  getDeviceCountByUserId (userId: number) {
    return this.userDeviceRepo.count({
      user: {
        id: userId
      }
    });
  }

  getDevicesByUserId (userId: number) {
    return this.userDeviceRepo.find({
      user: {
        id: userId
      }
    });
  }

  private async getDeviceByCredentialId (credentialId: Uint8Array, userId: number) {
    return this.userDeviceRepo.findOne({
      user: {
        id: userId
      },
      credentialID: credentialId
    });
  }

  async removeDeviceById (id: number, userId: number) {
    const device = await this.userDeviceRepo.findOne({
      user: {
        id: userId
      },
      id
    });

    if (!device) {
      throw new BadRequestException('Device does not exist');
    }

    await this.userDeviceRepo.getEntityManager().removeAndFlush([device]);
  }


  async startWebAuthnRegistration (userId: number) {
    const [user, devices] = await Promise.all([
      this.userService.getUserById(userId),
      this.getDevicesByUserId(userId)
    ]);

    const opts: GenerateRegistrationOptionsOpts = {
      rpName: this.rpName,
      rpID: this.rpId,
      userID: '' + user.id,
      userName: user.username,
      timeout: 60000,
      attestationType: 'none',
      /**
       * Passing in a user's list of already-registered authenticator IDs here prevents users from
       * registering the same device multiple times. The authenticator will simply throw an error in
       * the browser if it's asked to perform registration when one of these ID's already resides
       * on it.
       */
      excludeCredentials: devices.map(dev => ({
        id: dev.credentialID,
        type: 'public-key',
        transports: dev.transports,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      /**
       * Support the two most common algorithms: ES256, and RS256
       */
      supportedAlgorithmIDs: [-7, -257],
    };

    const options = await generateRegistrationOptions(opts);

    await this.userService.updateUser(user, { currentWebAuthnChallenge: options.challenge });

    return options;
  }

  async verifyWebAuthnRegistration (userId: number, name: string, registrationResponse: RegistrationResponseJSON) {
    const [user, devices] = await Promise.all([
      this.userService.getUserById(userId),
      this.getDevicesByUserId(userId)
    ]);
    const expectedChallenge = user.currentWebAuthnChallenge;

    if (!expectedChallenge) {
      throw new BadRequestException('No current challenge exists');
    }

    let verification: VerifiedRegistrationResponse;

    try {
      const opts: VerifyRegistrationResponseOpts = {
        response: registrationResponse,
        expectedChallenge: `${expectedChallenge}`,
        expectedOrigin: this.configService.getOrThrow('envUrl'),
        expectedRPID: this.rpId,
        requireUserVerification: true,
      };

      verification = await verifyRegistrationResponse(opts);
    } catch (e) {
      const error = e as Error;
      console.error(error);

      throw new BadRequestException(error.message);
    }

    const { verified, registrationInfo } = verification;


    if (verified && registrationInfo) {
      const { credentialPublicKey, credentialID, counter } = registrationInfo;


      const existingDevice = devices.find(device => isoUint8Array.areEqual(device.credentialID, credentialID));

      if (!existingDevice) {
        /**
         * Add the returned device to the user's list of devices
         */
        const newDevice: AuthenticatorDevice = {
          credentialPublicKey,
          credentialID,
          counter,
          transports: registrationResponse.response.transports,
        };

        this.userDeviceRepo.create({
          ...newDevice,
          user,
          name
        });

        await this.userDeviceRepo.getEntityManager().flush();
      }
    }

    await this.userService.updateUser(user, { currentWebAuthnChallenge: null });

    return {
      verified,
      user
    };
  }

  async startWebAuthn(userId: number) {
    const [user, devices] = await Promise.all([
      this.userService.getUserById(userId),
      this.getDevicesByUserId(userId)
    ]);

    const opts: GenerateAuthenticationOptionsOpts = {
      timeout: 60000,
      allowCredentials: devices.map(dev => ({
        id: dev.credentialID,
        type: 'public-key',
        transports: dev.transports,
      })),
      userVerification: 'required',
      rpID: this.rpId,
    };

    
    const options = await generateAuthenticationOptions(opts);
    await this.userService.updateUser(user, { currentWebAuthnChallenge: options.challenge });

    return options;
  }
  async verifyWebAuthn(userId: number, verificationOptions: AuthenticationResponseJSON) {
    const bodyCredIDBuffer = isoBase64URL.toBuffer(verificationOptions.rawId);

    const [user, authenticator] = await Promise.all([
      this.userService.getUserById(userId),
      this.getDeviceByCredentialId(bodyCredIDBuffer, userId)
    ]);

    const expectedChallenge = user.currentWebAuthnChallenge;

    // TODO: do the filter at the DB level

    if (!authenticator) {
      throw new BadRequestException('Authenticator is not registered with this site');
    }

    let verification: VerifiedAuthenticationResponse;
    try {
      const opts: VerifyAuthenticationResponseOpts = {
        response: verificationOptions,
        expectedChallenge: `${expectedChallenge}`,
        expectedOrigin: this.configService.getOrThrow('envUrl'),
        expectedRPID: this.rpId,
        authenticator,
        requireUserVerification: true
      };

      verification = await verifyAuthenticationResponse(opts);
    } catch (e) {
      console.error(e);
      throw new BadRequestException((e as Error).message);
    }

    if (verification.verified) {
      authenticator.counter = verification.authenticationInfo.newCounter;
      await this.userDeviceRepo.getEntityManager().flush();
    }

    await this.userService.updateUser(user, { currentWebAuthnChallenge: null });

    return {
      verified: verification.verified,
      user
    }
  }
}
