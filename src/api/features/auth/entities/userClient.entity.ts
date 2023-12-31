import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { User } from '../../users/users.entity.js';

@Entity()
export class UserClient {
  @PrimaryKey()
  id!: number;

  @Property()
  clientID!: string;

  @ManyToOne()
  user!: User;
}
