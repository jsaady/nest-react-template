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

await schema.ensureDatabase();

await schema.dropSchema({ dropMigrationsTable: true });

// await schema.createSchema();

// await orm.schema.createDatabase('test');

await orm.getMigrator().up();

await orm.seeder.seed(DefaultSeeder);

await orm.close();
