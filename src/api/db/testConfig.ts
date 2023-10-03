import {EntityClass} from "@mikro-orm/core";
import {defineConfig, Options} from "@mikro-orm/postgresql";

export function getTestMikroOrmConfig (entities: string[]|EntityClass<any>[] = ['./**/*.entity.js']): Options {
    return defineConfig({
        clientUrl: process.env.DATABASE_URL!,
        password: process.env.DATABASE_PASSWORD!,
        // entities,
        allowGlobalContext: true,
        entities,
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
    });
}