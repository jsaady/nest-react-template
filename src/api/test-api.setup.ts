import { Entity, MikroORM, PrimaryKey } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import dotenv from 'dotenv';
import { DefaultSeeder } from './db/seeds/DefaultSeeder.js';
import {getTestMikroOrmConfig} from "./db/testConfig.js";

@Entity()
export class MockEntity {
  @PrimaryKey()
  id!: number;
}

dotenv.config({
  path: '.env.test'
});

const orm = await MikroORM.init<PostgreSqlDriver>(getTestMikroOrmConfig([MockEntity]));

const schema = orm.getSchemaGenerator();

console.log('Ensuring database...');
await schema.ensureDatabase();

console.log('Dropping schema...');
await schema.dropSchema({ dropMigrationsTable: true });


console.log('Migrating...', await orm.getMigrator().getPendingMigrations());
await orm.getMigrator().up();

console.log(orm.config.getClientUrl());
// log all of the current tables for the connection
console.log(await orm.em.raw('SELECT * FROM information_schema.tables WHERE table_schema=\'public\''));

console.log('Migration done! Seeding...');
await orm.seeder.seed(DefaultSeeder);

await orm.close();
