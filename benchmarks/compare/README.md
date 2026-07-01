# ORM Comparison Benchmarks

This benchmark compares the same PostgreSQL scenarios across NPA, Prisma, and TypeORM. It is intentionally separate from the core NPA benchmark so Prisma and TypeORM do not become core package dependencies.

## Setup

Install the optional comparison dependencies. `benchmarks/compare` has its own pnpm workspace, so these dependencies stay out of the root package:

```bash
cd benchmarks/compare
pnpm install
pnpm prepare:prisma
cd ../..
```

Run the comparison from the repo root:

```bash
pnpm bench:compare -- --duration=60 --virtual-users=50 --pool-size=10
```

By default the runner executes ORM lanes one at a time. Each ORM lane gets its own PostgreSQL Testcontainer, the `npa_compare_users` table is recreated before each scenario/repeat, and the final table prints aggregate results.

Run repeated samples sequentially:

```bash
pnpm bench:compare -- --duration=60 --virtual-users=50 --pool-size=10 --repeat=3
```

## Existing Database

The runner can target an existing PostgreSQL database, but it drops and recreates `npa_compare_users`. Use this only against disposable benchmark databases:

```bash
pnpm bench:compare -- \
  --pg-url="postgres://user:pass@localhost:5432/bench" \
  --allow-destructive
```

## Options

- `--orms=npa,prisma,typeorm`: ORM lanes to run. Default: all three.
- `--scenario=read-heavy|write-and-read|all`: scenario filter. Default: `all`.
- `--duration=N`: seconds per ORM/scenario pair. Default: `10`.
- `--virtual-users=N` or `--vus=N`: concurrent workers. Default: `10`.
- `--pool-size=N`: PostgreSQL pool size per ORM client. Default: `10`.
- `--seed-rows=N`: deterministic read seed rows. Default: `1000`.
- `--repeat=N`: sequential repetitions per ORM/scenario pair. Default: `1`.
- `--json`: print machine-readable JSON.
- `--skip-prisma-generate`: skip automatic Prisma Client generation.

## Scenarios

- `read-heavy`: list top 10 users by name and get one user by id.
- `write-and-read`: create one user, then get it by id.

The result is only valid for this schema, query mix, machine, database version, pool size, repeat count, and ORM usage style. It is not a universal ORM ranking.
