import { MikroOrmModule } from '@mikro-orm/nestjs';
import {getTestMikroOrmConfig} from "../db/testConfig.js";

export const CreateMikroORM = (entities: any[]) => {
  return [
    MikroOrmModule.forRootAsync({
      useFactory: () => getTestMikroOrmConfig(entities),
    }),
    MikroOrmModule.forFeature(entities),
  ]
};