# @node-persistence-api/connector-pg

PostgreSQL runtime adapter for [Node Persistence API](https://github.com/honeybears/Node-Persistence-API).

## Install

```bash
npm install @node-persistence-api/connector-pg
```

## Usage

```ts
import { Pool } from 'pg';
import { createNPA } from '@node-persistence-api/core';
import {
  PostgresqlConnection,
  postgresql,
} from '@node-persistence-api/connector-pg';
import { UserRepository } from './user.repository';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const connection = new PostgresqlConnection(pool);

const npa = createNPA({
  adapter: postgresql({ connection }),
});

const users = npa.get(UserRepository);

await users.save({ name: 'kim' });
await users.findById(1);
await users.findByNameContainingIgnoreCase('ki');
await users.findAll({ orderBy: [{ property: 'name' }] });
```

Pass a transaction-capable connection when repository calls must share a
database transaction:

```ts
import { createNPA, Transactional } from '@node-persistence-api/core';
import { postgresql } from '@node-persistence-api/connector-pg';

const npa = createNPA({
  adapter: postgresql({ connection: pool }),
});

class UserService {
  private readonly users = npa.get(UserRepository);

  @Transactional()
  async rename(id: number, name: string): Promise<void> {
    await this.users.save({ id, name });
  }
}
```

## Migrations

```bash
npa db push --adapter postgresql --url "$DATABASE_URL" --entities "src/**/*.entity.ts"
npa migrate dev --adapter postgresql --url "$DATABASE_URL" --entities "src/**/*.entity.ts"
npa migrate deploy --adapter postgresql --url "$DATABASE_URL"
```
