import 'dotenv/config';
import { defineConfig, PostgreSqlDriver } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';

const dbUrl = new URL(process.env.DATABASE_URL!);

/**
 * @type {import('@mikro-orm/core').Options}
 */
export default defineConfig({
  driver: PostgreSqlDriver,
  clientUrl: dbUrl.href,
  entities: ['./dist/api/**/*.entity.js'],
  metadataProvider: TsMorphMetadataProvider,
  entitiesTs: ['./src/api/**/*.entity.ts'],
  migrations: {
    disableForeignKeys: false,
    path: './src/api/db/migrations'
  },
  seeder: {
    path: './src/api/db/seeds',
    defaultSeeder: 'DefaultSeeder',
    glob: '!(*.d).{js,ts}'
  }
})