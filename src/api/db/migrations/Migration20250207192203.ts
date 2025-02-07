import { Migration } from '@mikro-orm/migrations';

export class Migration20250207192203 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "user_invitation" ("id" serial primary key, "invite_code" varchar(255) not null, "inviter_id" int null);`);

    this.addSql(`create table "user_notification_preference" ("id" serial primary key, "user_id" int not null, "subscribe_to_all" boolean not null);`);
    this.addSql(`alter table "user_notification_preference" add constraint "user_notification_preference_user_id_unique" unique ("user_id");`);

    this.addSql(`alter table "user_invitation" add constraint "user_invitation_inviter_id_foreign" foreign key ("inviter_id") references "user" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "user_notification_preference" add constraint "user_notification_preference_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade;`);

    this.addSql(`alter table "generated_config" add column "csrf_secret" varchar(255) not null;`);

    this.addSql(`alter table "user" drop column "gitlab_id", drop column "is_admin";`);

    this.addSql(`alter table "user" add column "role" text check ("role" in ('admin', 'user', 'guest')) not null, add column "last_login_date" timestamptz null;`);
    this.addSql(`alter table "user" alter column "created_at" type timestamptz using ("created_at"::timestamptz);`);
    this.addSql(`alter table "user" alter column "created_at" drop not null;`);
    this.addSql(`alter table "user" alter column "updated_at" type timestamptz using ("updated_at"::timestamptz);`);
    this.addSql(`alter table "user" alter column "updated_at" drop not null;`);
    this.addSql(`alter table "user" alter column "email_token_date" type timestamptz using ("email_token_date"::timestamptz);`);
    this.addSql(`alter table "user" add constraint "user_email_unique" unique ("email");`);
    this.addSql(`alter table "user" add constraint "user_username_unique" unique ("username");`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "user_invitation" cascade;`);

    this.addSql(`drop table if exists "user_notification_preference" cascade;`);

    this.addSql(`alter table "generated_config" drop column "csrf_secret";`);

    this.addSql(`alter table "user" drop constraint "user_email_unique";`);
    this.addSql(`alter table "user" drop constraint "user_username_unique";`);
    this.addSql(`alter table "user" drop column "role", drop column "last_login_date";`);

    this.addSql(`alter table "user" add column "gitlab_id" varchar(255) null, add column "is_admin" boolean not null;`);
    this.addSql(`alter table "user" alter column "created_at" type timestamptz(0) using ("created_at"::timestamptz(0));`);
    this.addSql(`alter table "user" alter column "created_at" set not null;`);
    this.addSql(`alter table "user" alter column "updated_at" type timestamptz(0) using ("updated_at"::timestamptz(0));`);
    this.addSql(`alter table "user" alter column "updated_at" set not null;`);
    this.addSql(`alter table "user" alter column "email_token_date" type timestamptz(0) using ("email_token_date"::timestamptz(0));`);
  }

}
