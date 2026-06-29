import { createDerivedQueryRepository } from "./create-derived-query-repository";
import { NPARepository, NPARepositoryAdapter } from "./types";

export function createNPARepository<
  TRepository extends object,
  TEntity extends object,
  TId = unknown,
>(
  target: TRepository,
  adapter: NPARepositoryAdapter<TEntity, TId>,
): TRepository & NPARepository<TEntity, TId> {
  const repository = {
    save: adapter.save,
    insert: adapter.insert,
    update: adapter.update,
    updateById: adapter.updateById,
    delete: adapter.delete,
    deleteById: adapter.deleteById,
    ...target,
  };

  return createDerivedQueryRepository(repository, (invocation) =>
    adapter.executeDerivedQuery(invocation),
  ) as TRepository & NPARepository<TEntity, TId>;
}
