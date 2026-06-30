import { createNPARepository, NPARepository } from "@honeybeaers/npa";
import { PostgresqlRepositoryExecutor } from "./postgresql-repository-executor";
import { PostgresqlRepositoryOptions } from "./types";

export function createPostgresqlDerivedQueryRepository<
  TRepository extends object,
  TEntity extends object = Record<string, unknown>,
  TId = unknown,
>(
  target: TRepository,
  options: PostgresqlRepositoryOptions,
): TRepository & NPARepository<TEntity, TId> {
  const executor = new PostgresqlRepositoryExecutor<TEntity, TId>(options);
  return createNPARepository(target, executor);
}
