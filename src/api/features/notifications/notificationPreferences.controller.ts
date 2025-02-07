import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { AuthTokenContents } from '../auth/auth.dto.js';
import { IsAuthenticated } from '../auth/isAuthenticated.guard.js';
import { User } from '../auth/user.decorator.js';
import { NotificationPreferencesService } from './notificationPreferences.service.js';

@Controller('notifications/preferences')
@IsAuthenticated()
export class NotificationPreferencesController {
  constructor(
    private readonly userNotificationsService: NotificationPreferencesService
  ) {}

  @Get()
  async getUserNotificationPreferences(
    @User() { sub }: AuthTokenContents
  ) {
    return this.userNotificationsService.getUserNotificationPreferences(sub);
  }

  @Post('all')
  async subscribeToAllNotifications(
    @User() { sub }: AuthTokenContents
  ): Promise<void> {
    return this.userNotificationsService.subscribeToAllNotifications(sub);
  }
  @Delete('all')
  async unsubscribeFromAllNotifications(
    @User() { sub }: AuthTokenContents
  ): Promise<void> {
    await this.userNotificationsService.unsubscribeFromAllNotifications(sub);
  }
}