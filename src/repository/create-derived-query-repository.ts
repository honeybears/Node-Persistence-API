import {
  assertNoDuplicateQueryPredicates,
  parseQueryMethod,
} from "../query-method";
import { getEntityGraphMetadata } from "./entity-graph-decorator";
import { getRawQueryMetadata } from "./query-decorator";
import {
  RepositoryMethodInvocation,
  RepositoryMethodExecutor,
  RepositoryRawQueryInvocation,
  RepositoryRawQueryExecutor,
} from "./types";

export function createDerivedQueryRepository<TRepository extends object>(
  target: TRepository,
  executor: RepositoryMethodExecutor,
  rawExecutor?: RepositoryRawQueryExecutor,
): TRepository {
  return new Proxy(target, {
    get(currentTarget, property, receiver) {
      if (typeof property !== "string") {
        return Reflect.get(currentTarget, property, receiver);
      }

      const rawQuery = getRawQueryMetadata(currentTarget, property);
      const entityGraph = getEntityGraphMetadata(currentTarget, property);

      if (rawQuery) {
        return (...args: unknown[]) => {
          if (!rawExecutor) {
            throw new Error(
              `Repository method "${property}" uses @Query, but the adapter does not support raw queries.`,
            );
          }

          const invocation: RepositoryRawQueryInvocation = {
            query: rawQuery,
            methodName: property,
            args,
          };

          if (entityGraph) {
            invocation.entityGraph = entityGraph;
          }

          return rawExecutor(invocation);
        };
      }

      if (property in currentTarget) {
        return Reflect.get(currentTarget, property, receiver);
      }

      return (...args: unknown[]) => {
        const query = parseQueryMethod(property);
        assertNoDuplicateQueryPredicates(query);

        if (args.length !== query.parameterCount) {
          throw new Error(
            `Query method "${property}" expects ${query.parameterCount} parameter(s), received ${args.length}.`,
          );
        }

        const invocation: RepositoryMethodInvocation = { query, args };

        if (entityGraph) {
          invocation.entityGraph = entityGraph;
        }

        return executor(invocation);
      };
    },
  });
}
