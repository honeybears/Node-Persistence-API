import { parseQueryMethod } from "./parse-query-method";
import { assertNoDuplicateQueryPredicates } from "./validation";
import { QueryMethodExecutor } from "./types";

export function createQueryMethodProxy<TTarget extends object>(
  target: TTarget,
  executor: QueryMethodExecutor,
): TTarget {
  return new Proxy(target, {
    get(currentTarget, property, receiver) {
      if (typeof property !== "string" || property in currentTarget) {
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

        return executor(query, args);
      };
    },
  });
}
