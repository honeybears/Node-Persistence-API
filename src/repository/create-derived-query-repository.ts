import { createQueryMethodProxy } from "../query-method";
import { RepositoryMethodExecutor } from "./types";

export function createDerivedQueryRepository<TRepository extends object>(
  target: TRepository,
  executor: RepositoryMethodExecutor,
): TRepository {
  return createQueryMethodProxy(target, (query, args) =>
    executor({ query, args }),
  );
}
