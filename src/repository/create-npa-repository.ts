import { createDerivedQueryRepository } from "./create-derived-query-repository";
import { getEntityGraphMetadata } from "./entity-graph-decorator";
import {
  NPARepository,
  NPARepositoryAdapter,
  NPAFindOptions,
  NPALoadOptions,
  NPARelationLoadTree,
} from "./types";

export function createNPARepository<
  TRepository extends object,
  TEntity extends object,
  TId = unknown,
>(
  target: TRepository,
  adapter: NPARepositoryAdapter<TEntity, TId>,
): TRepository & NPARepository<TEntity, TId> {
  const repository = Object.assign(
    Object.create(Object.getPrototypeOf(target) ?? Object.prototype),
    {
      findById: (id: TId, options?: NPALoadOptions<TEntity>) =>
        adapter.findById(
          id,
          mergeLoadOptions(
            toLoadOptions(getEntityGraphMetadata(target, "findById")),
            options,
          ),
        ),
      findAll: (options?: NPAFindOptions<TEntity>) =>
        adapter.findAll(
          mergeLoadOptions(
            toLoadOptions(getEntityGraphMetadata(target, "findAll")),
            options,
          ),
        ),
      existsById: adapter.existsById,
      count: adapter.count,
      persist: adapter.persist,
      save: adapter.save,
      insert: adapter.insert,
      update: adapter.update,
      updateById: adapter.updateById,
      remove: adapter.remove,
      delete: adapter.delete,
      deleteById: adapter.deleteById,
      deleteAll: adapter.deleteAll,
    },
    target,
  );

  return createDerivedQueryRepository(
    repository,
    (invocation) => adapter.executeDerivedQuery(invocation),
    (invocation) => {
      if (!adapter.executeRawQuery) {
        throw new Error(
          `Repository method "${invocation.methodName}" uses @Query, but the adapter does not support raw queries.`,
        );
      }

      return adapter.executeRawQuery(invocation);
    },
  ) as TRepository & NPARepository<TEntity, TId>;
}

function toLoadOptions<TEntity extends object>(
  entityGraph: ReturnType<typeof getEntityGraphMetadata> | undefined,
): NPALoadOptions<TEntity> | undefined {
  return entityGraph ? { relations: entityGraph.relations } : undefined;
}

function mergeLoadOptions<TEntity extends object>(
  left: NPALoadOptions<TEntity> | undefined,
  right: NPAFindOptions<TEntity> | undefined,
): NPAFindOptions<TEntity> | undefined {
  if (!left?.relations) {
    return right;
  }

  if (!right?.relations) {
    return { ...right, relations: left.relations };
  }

  const leftRelations = left.relations;
  const rightRelations = right.relations;

  if (leftRelations === true || rightRelations === true) {
    return { relations: true };
  }

  if (Array.isArray(leftRelations) && Array.isArray(rightRelations)) {
    return { relations: [...new Set([...leftRelations, ...rightRelations])] };
  }

  return {
    ...right,
    relations: {
      ...toRelationTree(leftRelations),
      ...toRelationTree(rightRelations),
    },
  };
}

function toRelationTree(
  relations: ReadonlyArray<string> | NPARelationLoadTree,
): NPARelationLoadTree {
  if (Array.isArray(relations)) {
    return Object.fromEntries(relations.map((relation) => [relation, true]));
  }

  return relations;
}
