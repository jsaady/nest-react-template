import { MikroORM } from '@mikro-orm/core';
import { Test, TestingModule } from '@nestjs/testing';
import PgBoss, { Job } from 'pg-boss';
import { MockConfigModule } from '../../testFixtures/config.mock.js';
import { CreateMikroORM } from '../../testFixtures/mikroOrm.mock.js';
import { GeneratedConfig } from '../../utils/config/generated-config.entity.js';
import { User } from '../users/users.entity.js';
import { Subscription } from './entities/subscription.entity.js';
import { AddSubscriptionDTO, BatchNotificationDTO, SendNotificationDTO } from './notification.dto.js';
import { NotificationDevicesService } from './notificationDevices.service.js';
import { UserRole } from '../users/userRole.enum.js';
const extraUserId = 200;
const extraUserId2 = 400;

describe('NotificationDevicesService', () => {
  let service: NotificationDevicesService;
  let module: TestingModule;
  let mikroOrm: MikroORM;
  let extraUserId: number;
  let extraUserId2: number;
  const mockWebPush = {
    sendNotification: vitest.fn(),
  };
  const mockPgBoss = {
    send: vitest.fn(),
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ...CreateMikroORM([User, Subscription, GeneratedConfig]),
        MockConfigModule,
      ],
      providers: [
        NotificationDevicesService,
        { provide: 'WEB_PUSH', useValue: mockWebPush },
        {
          provide: PgBoss,
          useValue: mockPgBoss,
        },
      ],
    }).compile();

    service = module.get<NotificationDevicesService>(NotificationDevicesService);
    mikroOrm = module.get<MikroORM>(MikroORM);
    extraUserId = await mikroOrm.em.insert(User, {
      email: 'test_not1@test.com',
      username: 'test_not1',
      role: UserRole.ADMIN,
      password: '',
      needPasswordReset: false,
      emailConfirmed: true
    });
    extraUserId2 = await mikroOrm.em.insert(User, {
      email: 'test_not2@test.com',
      username: 'test_not2',
      role: UserRole.ADMIN,
      password: '',
      needPasswordReset: false,
      emailConfirmed: true
    });

    return async () => {
      await mikroOrm.em.nativeDelete(Subscription, {});
      await mikroOrm.em.nativeDelete(User, {
        id: extraUserId
      });
      await mikroOrm.em.nativeDelete(User, {
        id: extraUserId2
      });
      await module?.close();
    };
  });

  afterEach(async () => {
    vitest.resetAllMocks();
    await mikroOrm.em.nativeDelete(Subscription, {
      user: { id: 1 },
    });
  });

  describe('getDevices', () => {
    it('should return all devices for a user', async () => {
      mikroOrm.em.persistAndFlush(
        mikroOrm.em.create(Subscription, {
          user: mikroOrm.em.getReference(User, 1),
          endpoint: 'https://example.com',
          keys: { p256dh: 'p256dh', auth: 'auth' },
        }),
      );

      const devices = await service.getDevices(1);

      expect(devices).toHaveLength(1);
    });
  });

  describe('addSubscription', () => {
    it('should add a new subscription', async () => {
      const userId = 1;

      const subscriptionDto: AddSubscriptionDTO = {
        endpoint: 'https://example.com',
        keys: { p256dh: 'p256dh', auth: 'auth' },
      };

      const subscription = await service.addSubscription(userId, subscriptionDto);

      expect(subscription).toBeDefined();
      expect(subscription.id).toBeDefined();
      expect(subscription.user.id).toBe(userId);
      expect(subscription.endpoint).toBe(subscriptionDto.endpoint);
      expect(subscription.keys).toEqual(subscriptionDto.keys);
    });
  });

  describe('removeSubscription', () => {
    it('should remove a subscription', async () => {
      const userId = 1;

      const subscriptionDto: AddSubscriptionDTO = {
        endpoint: 'https://example.com',
        keys: { p256dh: 'p256dh', auth: 'auth' },
      };

      const subscription = await service.addSubscription(userId, subscriptionDto);

      expect(subscription).toBeDefined();

      const result = await service.removeSubscription(userId);

      expect(result).toBeDefined();
      expect(result).toBeGreaterThan(0);
    });
  });

  describe('sendNotification', () => {
    it('should send a notification', async () => {
      const userId = 1;
      const subscriptionDto: AddSubscriptionDTO = {
        endpoint: 'https://example.com',
        keys: { p256dh: 'p256dh', auth: 'auth' },
      };

      await service.addSubscription(userId, subscriptionDto);
      const text = 'Hello, world!';
      const title = 'Test Notification';

      const sendNotificationDto: SendNotificationDTO = { userId, text, title };

      const result = await service.sendNotification(sendNotificationDto);

      expect(mockWebPush.sendNotification).toBeCalledTimes(1);

      expect(result).toBe(true);
    });

    it('should throw an error if user is not subscribed', async () => {
      const userId = 4;
      const text = 'Hello, world!';
      const title = 'Test Notification';

      const sendNotificationDto: SendNotificationDTO = { userId, text, title };

      await expect(service.sendNotification(sendNotificationDto)).rejects.toThrow('User not subscribed to notifications');
    });

    it('should handle when web push throws an error', async () => {
      const userId = 1;
      const subscriptionDto: AddSubscriptionDTO = {
        endpoint: 'https://example.com',
        keys: { p256dh: 'p256dh', auth: 'auth' },
      };

      await service.addSubscription(userId, subscriptionDto);
      const text = 'Hello, world!';
      const title = 'Test Notification';

      const sendNotificationDto: SendNotificationDTO = { userId, text, title };

      mockWebPush.sendNotification.mockImplementationOnce(() => {
        throw new Error('Test Error');
      });

      await expect(service.sendNotification(sendNotificationDto)).rejects.toThrow();
    });
  });

  describe('batchNotify', () => {
    it('should send a batch notification', async () => {
      const dto = {
        title: 'Test Notification',
        text: 'Hello, world!',
        userIds: [1, extraUserId, extraUserId2],
      };

      service.batchNotify(dto);

      expect(mockPgBoss.send).toBeCalledTimes(1);
    });
  });

  describe('processBatchNotification', () => {
    it('should send a notification to all users in the batch', async () => {
      const dto = {
        title: 'Test Notification',
        text: 'Hello, world!',
        userIds: [1, extraUserId, extraUserId2],
      };

      const subscriptionDto: AddSubscriptionDTO = {
        endpoint: 'https://example.com',
        keys: { p256dh: 'p256dh', auth: 'auth' },
      };

      for (const userId of dto.userIds) {
        await service.addSubscription(userId, subscriptionDto);
      }

      await service.processBatchNotification({ data: dto } as unknown as Job<BatchNotificationDTO>);

      expect(mockWebPush.sendNotification).toBeCalledTimes(3);
    });
  });
});
