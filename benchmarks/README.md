# NPA Benchmarks

This folder contains reproducible local benchmarks for the NPA hot paths. The default benchmark does not require a database; it measures query method parsing, duplicate predicate validation, repository proxy dispatch, in-memory execution, and PostgreSQL/MySQL SQL compilation.

## Commands

```bash
pnpm bench
```

Use smaller runs while developing:

```bash
pnpm bench -- --iterations=1000 --warmup=100
```

Print JSON for regression tracking:

```bash
pnpm bench -- --json > benchmark-result.json
```

Run live database benchmarks only when you explicitly provide URLs:

```bash
NPA_BENCH_PG_URL=postgres://user:pass@localhost:5432/db \
NPA_BENCH_MYSQL_URL=mysql://user:pass@localhost:3306/db \
pnpm bench -- --live
```

Live benchmarks create temporary `npa_bench_users` tables on a single connection and run `findOneByEmail` through the NPA repository adapter. They measure driver round trips too, so compare them separately from the no-DB microbenchmarks.

## Comparing With Prisma or TypeORM

The harness accepts optional comparison lanes:

```bash
pnpm bench -- --include=npa,prisma,typeorm
```

Those lanes are reported as skipped until a benchmark app provides generated Prisma Client or a TypeORM DataSource fixture. Keep those dependencies out of the core package unless a dedicated comparison workspace is added.

## Reading Results

- `Ops/s`: throughput for the measured operation.
- `Avg us`: average latency per operation in microseconds.
- `P50/P95/P99 us`: latency percentiles from per-iteration samples.

Use the same machine, Node version, iteration count, and database location when comparing runs.
