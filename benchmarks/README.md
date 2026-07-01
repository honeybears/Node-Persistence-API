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

Run live database benchmarks with Testcontainers:

```bash
pnpm bench -- --live
```

The live run prints a K6-style performance report with read-heavy and write-and-read scenarios. Defaults are short for local iteration: 10 virtual users, 10 seconds per scenario, and a pool size of 10. To match a longer issue-report style run:

```bash
pnpm bench -- --live --duration=60 --virtual-users=50 --pool-size=10
```

Use `--scenario=read-heavy` or `--scenario=write-and-read` to run only one scenario.

When `--live` is used, the harness starts PostgreSQL and MySQL containers unless URLs are provided. Use explicit URLs to benchmark an existing database instead:

```bash
NPA_BENCH_PG_URL=postgres://user:pass@localhost:5432/db \
NPA_BENCH_MYSQL_URL=mysql://user:pass@localhost:3306/db \
pnpm bench -- --live
```

Live benchmarks create isolated `npa_bench_*` tables, seed deterministic rows, and run repository methods through a configured pool. `Ops/s` is TPS for the single-query lane; the performance report includes avg/p95 latencies, total operations, operations per second, and error counts per scenario. Override images with `NPA_BENCH_POSTGRESQL_IMAGE` and `NPA_BENCH_MYSQL_IMAGE`.

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
