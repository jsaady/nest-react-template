import { Entity, ManyToOne, PrimaryKey, Property, Uint8ArrayType } from '@mikro-orm/core';
import { AuthenticatorDevice, AuthenticatorTransportFuture } from '@simplewebauthn/typescript-types';
import { User } from '../../users/users.entity.js';

@Entity()
export class UserDevice implements AuthenticatorDevice {
  @PrimaryKey()
  id!: number;

  @Property()
  name!: string;

  @Property({ type: Uint8ArrayType })
  credentialPublicKey!: Uint8Array;

  @Property({ type: Uint8ArrayType })
  credentialID!: Uint8Array;

  @Property()
  counter!: number;

  @ManyToOne()
  user!: User;

  @Property({ type: 'json', nullable: true })
  transports?: AuthenticatorTransportFuture[] | undefined;
}
