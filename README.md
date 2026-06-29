# Node Persistence API (NPA)

NPA provides Spring Data JPA style repositories for Node and TypeScript. Application code
depends on `NPARepository<TEntity, TId>`, while the selected adapter handles the
actual database runtime such as PostgreSQL or MySQL.

## Install

```bash
npm install @honeybeaers/node-persistence-api
```

## Entity Model

```ts
import {
  Column,
  Entity,
  Id,
  ManyToMany,
  ManyToOne,
  NPARepository,
  OneToMany,
} from '@honeybeaers/node-persistence-api';

@Entity({ name: 'users', schema: 'app' })
class User {
  @Id({ name: 'user_id' })
  id?: number;

  @Column({ name: 'full_name' })
  name!: string;

  @Column({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Team, { joinColumn: 'team_id' })
  team?: Team;

  @ManyToMany(() => Role, { joinTable: 'user_roles' })
  roles?: Role[];
}
```

`@Entity`, `@Id`, and `@Column` drive table, primary key, and column mapping.
Relation decorators are recorded as metadata for association support.
Entity classes must be exported so the generated client can import them.

## Repository Usage

Application code extends only NPA, not a database-specific repository type.

```ts
interface UserRepository extends NPARepository<User, number> {
  findTop10ByNameContainingOrderByCreatedAtDesc(
    name: string,
  ): Promise<User[]>;
  existsByName(name: string): Promise<boolean>;
  deleteByNameContaining(name: string): Promise<number>;
}
```

## CLI Generate

Run `npa generate` to create a typed client file. This is what makes method-name
query autocomplete visible in TypeScript.

```bash
npa generate \
  --entities "src/**/*.entity.ts" \
  --out src/generated/npa.ts \
  --adapter postgresql
```

Use `--adapter mysql` to generate a MySQL-backed client factory.

Generated output includes:

```ts
export interface UserRepository extends NPARepository<User, number> {
  findByName(value: NonNullable<User['name']>): Promise<User[]>;
  findByNameContaining(value: NonNullable<User['name']>): Promise<User[]>;
  deleteByNameContaining(value: NonNullable<User['name']>): Promise<number>;
  countByCreatedAtBetween(
    min: NonNullable<User['createdAt']>,
    max: NonNullable<User['createdAt']>,
  ): Promise<number>;
}

export interface NPAClient {
  user: UserRepository;
}
```

The generator creates single-field method variants for `find`, `findOne`,
`exists`, `count`, and `delete`. Complex multi-field methods can still be
declared manually on your repository interface.

## Adapter Wiring

Choose the adapter in composition code. PostgreSQL and MySQL both implement the
same `NPARepositoryAdapter` contract.

### PostgreSQL

```ts
import { Pool } from 'pg';
import { createNPAClient } from './generated/npa';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const npa = createNPAClient({
  postgresql: {
    queryable: pool,
  },
});

const users = npa.user;

await users.insert({ name: 'kim', createdAt: new Date() });
await users.save({ id: 1, name: 'lee', createdAt: new Date() });
await users.updateById(1, { name: 'park' });
await users.deleteById(1);
await users.findTop10ByNameContainingOrderByCreatedAtDesc('ki');
```

### MySQL

Generate a MySQL client first:

```bash
npa generate \
  --entities "src/**/*.entity.ts" \
  --out src/generated/npa.ts \
  --adapter mysql
```

Then wire it with a `mysql2` pool or connection.

```ts
import mysql from 'mysql2/promise';
import { createNPAClient } from './generated/npa';

const pool = mysql.createPool(process.env.DATABASE_URL);

const npa = createNPAClient({
  mysql: {
    queryable: pool,
  },
});

const users = npa.user;

await users.insert({ name: 'kim', createdAt: new Date() });
await users.save({ id: 1, name: 'lee', createdAt: new Date() });
await users.updateById(1, { name: 'park' });
await users.deleteById(1);
await users.findTop10ByNameContainingOrderByCreatedAtDesc('ki');
```

## Runtime Flow

1. Service code calls a method on `UserRepository`.
2. Concrete CRUD methods (`save`, `insert`, `updateById`, `deleteById`) go
   through the NPA adapter directly.
3. Derived methods (`findBy...`, `existsBy...`, `countBy...`, `deleteBy...`) are
   parsed into a query AST.
4. The selected adapter compiles the AST with entity metadata and executes it.

## Develop

```bash
pnpm install
pnpm build
pnpm test
pnpm pack
```
