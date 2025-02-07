import { MikroORM } from '@mikro-orm/core';
import { Test, TestingModule } from '@nestjs/testing';
import { MockConfigModule } from '../../testFixtures/config.mock.js';
import { CreateMikroORM } from '../../testFixtures/mikroOrm.mock.js';
import { CreateUserDTO } from './users.dto.js';
import { User } from './users.entity.js';
import { UserService } from './users.service.js';
import { UserRole } from './userRole.enum.js';
import { EntityManager } from '@mikro-orm/postgresql';

const generateMockUser = (email = 'test@test.com', username = 'test', password = ''): CreateUserDTO => ({
  email,
  password,
  username,
  role: UserRole.USER,
  needPasswordReset: false,
  emailConfirmed: false,
  lastLoginDate: new Date(),
});

describe('UserService', () => {
  let module: TestingModule;
  let service: UserService;
  let em: EntityManager;


  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ...CreateMikroORM([User]),
        MockConfigModule,
      ],
      providers: [
        UserService,
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    em = module.get<EntityManager>(EntityManager);
  });

  afterAll(async () => {
    await module?.close();
  });

  afterEach(() => {
    return em.nativeDelete(User, {
      id: {
        $gt: 3,
      }
    });
  });

  describe('create', () => {
    it('should create a user', async () => {
      const user = await service.create(generateMockUser('test1@test.com', 'test1'));

      expect(user).toMatchObject({
        email: 'test1@test.com',
        password: '',
      });

      const userFromDb = await em.findOne(User, user.id);
      expect(userFromDb).toMatchObject({
        email: 'test1@test.com',
        password: '',
      });
    });

    it('should hash the password', async () => {
      const user = await service.create(generateMockUser('test2@test.com', 'test2'));

      expect(user).toMatchObject({
        email: 'test2@test.com',
        password: expect.not.stringMatching('test'),
      });
    });
  });

  describe('findByEmail', () => {
    it('should find a user by email', async () => {
      const user = await service.create(generateMockUser('test3@test.com', 'test3'));

      const foundUser = await service.getUserByEmail(user.email);
      expect(foundUser).toMatchObject({
        email: 'test3@test.com',
        password: '',
      });

      const userFromDb = await em.findOne(User, user.id);
      expect(userFromDb).toMatchObject({
        email: 'test3@test.com',
        password: '',
      });

      expect(foundUser).toEqual(userFromDb);
    });

    it('should return null if no user is found', async () => {
      const foundUser = await service.getUserByEmail('tester@test.com');

      expect(foundUser).toBeNull();
    });
  });
});

