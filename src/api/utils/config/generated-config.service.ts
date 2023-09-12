import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webPush from 'web-push';
import { IS_MIGRATED } from '../../db/migration.provider.js';
import { CONFIG_VARS, FullConfig } from './config.js';
import { GeneratedConfig } from './generated-config.entity.js';
@Injectable()
export class GeneratedConfigService {

  constructor(
    private config: ConfigService,
    @Inject(IS_MIGRATED) isMigrated: boolean,
    @InjectRepository(GeneratedConfig) private repo: EntityRepository<GeneratedConfig>,
  ) {}

  private get em() {
    return this.repo.getEntityManager().fork();
  }

  private rand (size: number) {
    return [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
  }

  async fetchConfig(): Promise<FullConfig> {
    let existingConfig = await this.em.findOne(GeneratedConfig, { id: 1 });
    
    if (!existingConfig) {
      console.log('Initializing config');
      const vapidCreds = webPush.generateVAPIDKeys();
      
      existingConfig = this.em.create(GeneratedConfig, {
        id: 1,
        jwtSecret: this.rand(16),
        cookieSecret: this.rand(16),
        vapidPublic: vapidCreds.publicKey,
        vapidPrivate: vapidCreds.privateKey
      });
      await this.em.persistAndFlush(existingConfig);
    } else {
      console.log('Using existing config');
    }

    const config = Object.assign({}, existingConfig, {
      emailHost: this.config.getOrThrow(CONFIG_VARS.emailHost),
      emailPort: this.config.getOrThrow(CONFIG_VARS.emailPort),
      emailUser: this.config.getOrThrow(CONFIG_VARS.emailUser),
      emailPassword: this.config.getOrThrow(CONFIG_VARS.emailPassword),
      emailReplyTo: this.config.getOrThrow(CONFIG_VARS.emailReplyTo),
      envUrl: this.config.getOrThrow(CONFIG_VARS.envUrl),
      envName: this.config.getOrThrow(CONFIG_VARS.envName),
    });

    return config;
  }
}
