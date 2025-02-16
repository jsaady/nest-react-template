import { MikroOrmModule } from '@mikro-orm/nestjs';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService as NestConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { resolve } from 'path';
import { MigrationModule } from './db/migration.provider.js';
import { AuthModule } from './features/auth/auth.module.js';
import { UsersModule } from './features/users/users.module.js';
import { RATE_LIMIT_LIMIT, RATE_LIMIT_TTL } from './utils/config/config.js';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { WorkersModule } from '@nestjs-enhanced/workers';
import { QueueModule } from '@nestjs-enhanced/pg-boss';
import { PubSubModule } from '@nestjs-enhanced/pub-sub';
import { SocketsModule } from '@nestjs-enhanced/sockets';
import { ContextModule } from '@nestjs-enhanced/context';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { NotificationsModule } from './features/notifications/notifications.module.js';

const currentDir = resolve(new URL(import.meta.url).pathname, '..');

@Module({
  imports: [
    NestConfigModule.forRoot(),
    PrometheusModule.register({
      defaultMetrics: {
        enabled: true,
        // See https://github.com/siimon/prom-client#configuration
        config: {},
      },
    }),
    WorkersModule,
    MigrationModule,
    ServeStaticModule.forRoot({
      rootPath: resolve(currentDir, '..', 'ui')
    }),
    QueueModule.registerAsync({
      useFactory: (config) => {
        const ca = getDBCA();

        return {
          connectionString: config.getOrThrow('DATABASE_URL'),
          ssl: ca ? {
            ca,
            rejectUnauthorized: true
          } : undefined,
        };
      },
      inject: [NestConfigService],
      imports: [NestConfigModule]
    }),
    PubSubModule.registerPostgresAsync({
      useFactory: (config) => {
        const connectionString = config.getOrThrow('DATABASE_URL');
        const ca = getDBCA();

        return {
          connectionString: connectionString,
          ssl: ca ? {
            rejectUnauthorized: true,
            ca,
          } : undefined,
        }
      },
      inject: [NestConfigService],
      imports: [NestConfigModule]
    }),
    SocketsModule,
    ContextModule,
    AuthModule,
    NotificationsModule,
    UsersModule,
    ThrottlerModule.forRoot([{
      ttl: RATE_LIMIT_TTL,
      limit: RATE_LIMIT_LIMIT
    }]),
    MikroOrmModule.forRootAsync({
      useFactory: (config: NestConfigService) => {
        // let url = config.get('DATABASE_URL')!;

        // if (!url) {
        //   url = `${}`
        // }

        const url = config.getOrThrow('DATABASE_URL')!;

        return {
          clientUrl: url,
          driver: PostgreSqlDriver,
          password: config.getOrThrow('DATABASE_PASSWORD'),
          entities: ['./**/*.entity.js'],
          entitiesTs: ['./**/*.entity.ts'],
          migrations: {
            disableForeignKeys: false,
            path: './dist/api/db/migrations',
            pathTs: './src/api/db/migrations'
          },
          seeder: {
            defaultSeeder: 'DefaultSeeder',
            path: './dist/api/db/seeds',
            pathTs: './src/api/db/seeds',
            glob: '!(*.d).{js,ts}'
          }
        };
      },
      inject: [NestConfigService],
      imports: [NestConfigModule]
    })
  ],
  providers: [{
    provide: APP_GUARD,
    useClass: ThrottlerGuard
  }],
})
export class AppModule {}

function getDBCA () {
  let ca = process.env.DB_CA_CERTIFICATE;

  if (ca) {
    return Buffer.from(ca, 'base64').toString('utf-8');
  }
}
