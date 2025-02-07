import { Collection, Entity, ManyToMany, OneToMany, OneToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { User } from '../../users/users.entity.js';

@Entity()
export class UserNotificationPreference {

  @PrimaryKey({ autoincrement: true })
  id!: number;

  @OneToOne()
  user!: User;

  // @Property()
  // emailEnabled!: boolean;

  @Property()
  subscribeToAll!: boolean;
}
