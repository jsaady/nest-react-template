import { EntityManager } from '@mikro-orm/core';
import { getRepositoryToken } from '@mikro-orm/nestjs';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { IS_MIGRATED } from '../../db/migration.provider.js';
import { GeneratedConfig } from './generated-config.entity.js';
import { GeneratedConfigService } from './generated-config.service.js';
import { Mock } from 'vitest';

describe('GeneratedConfigService', () => {
  let service: GeneratedConfigService;
  const mockEm: Partial<Record<keyof EntityManager, Mock>> = {
    findOne: vitest.fn(),
    create: vitest.fn(),
    persistAndFlush: vitest.fn(),
    fork: vitest.fn().mockImplementation(() => mockEm)
  };
  beforeEach(async () => {


    const module = await Test.createTestingModule({
      providers: [
        GeneratedConfigService,
        {
          provide: IS_MIGRATED,
          useValue: true,
        },
        {
          provide: getRepositoryToken(GeneratedConfig),
          useValue: {
            findOne: vitest.fn(),
            create: vitest.fn(),
            persistAndFlush: vitest.fn(),
            getEntityManager: vitest.fn().mockReturnValue(mockEm),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: vitest.fn(),
            get: vitest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GeneratedConfigService>(GeneratedConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should fetch config', async () => {
    const existingConfig = {
      id: 1,
      jwtSecret: 'jwtSecret',
      cookieSecret: 'cookie secret',
      vapidPublic: 'vapid public',
      vapidPrivate: 'vapid private',
    };
    mockEm.findOne?.mockResolvedValue(existingConfig);
    const config = await service.fetchConfig();

    expect(config).toMatchObject({
      ...existingConfig,
    });
  });

  it('should initialize config', async () => {
    mockEm.findOne?.mockResolvedValue(null);
    mockEm.create?.mockImplementation((_, data) => data);
    const config = await service.fetchConfig();

    expect(config).toMatchObject({
      id: 1,
      jwtSecret: expect.any(String),
      cookieSecret: expect.any(String),
      vapidPublic: expect.any(String),
      vapidPrivate: expect.any(String),
    });
  });
});