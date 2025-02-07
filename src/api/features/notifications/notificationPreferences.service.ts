import { EntityManager, wrap } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { User } from '../users/users.entity.js';
import { UserNotificationPreference } from './entities/userNotificationPreference.entity.js';

@Injectable()
export class NotificationPreferencesService {
  constructor(
    private em: EntityManager
  ) {}

  async subscribeToAllNotifications(userId: number): Promise<void> {
    const userRef = this.em.getReference(User, userId);
    let preference = await this.em.findOne(UserNotificationPreference, { user: userRef }, { populate: ['user', 'subscribeToAll'] }) as UserNotificationPreference;

    if (!preference) {
      preference = wrap(new UserNotificationPreference()).assign({ user: userRef }) as UserNotificationPreference;
      this.em.persist(preference);
    }
    
    preference.subscribeToAll = true;

    await this.em.flush();
  }

  async unsubscribeFromAllNotifications(userId: number): Promise<void> {
    const userRef = this.em.getReference(User, userId);
    let preference = await this.em.findOne(UserNotificationPreference, { user: userRef }, { populate: ['user', 'subscribeToAll'] }) as UserNotificationPreference;

    if (!preference) {
      return;
    }

    preference.subscribeToAll = false;

    await this.em.flush();
  }

  async getUserIdsToNotify(): Promise<number[]> {
    const userIds = new Set<number>();

    const preferencesWithAll = await this.em.find(UserNotificationPreference, { subscribeToAll: true }, { populate: ['user'] });

    for (const preference of preferencesWithAll) {
      userIds.add(preference.user.id);
    }
    
    return [...userIds];
  }

  async getUserNotificationPreferences(userId: number): Promise<UserNotificationPreference> {
    const userRef = this.em.getReference(User, userId);
    let preferences = await this.em.findOne(UserNotificationPreference, { user: userRef }, { populate: ['subscribeToAll'] }) as UserNotificationPreference;

    if (!preferences) {
      preferences = wrap(new UserNotificationPreference()).assign({ user: userRef }) as UserNotificationPreference;
      preferences.subscribeToAll = false;
      this.em.persist(preferences);
      await this.em.flush();
    }

    return preferences;
  }
}