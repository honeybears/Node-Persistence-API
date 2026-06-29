import { NPARepositoryAdapter, RepositoryMethodExecutor } from "../repository";
import {
  compilePostgresqlDeleteById,
  compilePostgresqlInsert,
  compilePostgresqlUpdate,
  getPrimaryKeyValue,
} from "./postgresql-crud-compiler";
import { compilePostgresqlQuery } from "./postgresql-query-compiler";
import { PostgresqlRepositoryOptions } from "./types";

export class PostgresqlRepositoryExecutor<TEntity extends object, TId = unknown>
  implements NPARepositoryAdapter<TEntity, TId>
{
  constructor(private readonly options: PostgresqlRepositoryOptions) {}

  executeDerivedQuery: RepositoryMethodExecutor<Promise<unknown>> = async (
    invocation,
  ) => {
    const query = compilePostgresqlQuery(invocation, this.options);
    const result = await this.options.queryable.query(query.text, query.values);

    switch (invocation.query.action) {
      case "find":
        return result.rows;
      case "findOne":
        return result.rows[0] ?? null;
      case "exists":
        return Boolean(result.rows[0]?.exists);
      case "count":
        return Number(result.rows[0]?.count ?? 0);
      case "delete":
        return result.rowCount ?? 0;
    }
  };

  execute = this.executeDerivedQuery;

  save = async (
    entity: TEntity,
  ): Promise<TEntity | null> => {
    const id = getPrimaryKeyValue(entity, this.options);
    return id === null || id === undefined
      ? this.insert(entity)
      : this.update(entity);
  };

  insert = async (entity: TEntity): Promise<TEntity> => {
    const query = compilePostgresqlInsert(entity, this.options);
    const result = await this.options.queryable.query<TEntity>(
      query.text,
      query.values,
    );

    if (!result.rows[0]) {
      throw new Error("PostgreSQL insert did not return a row.");
    }

    return result.rows[0];
  };

  update = async (
    entity: TEntity,
  ): Promise<TEntity | null> => {
    const id = getPrimaryKeyValue(entity, this.options);
    return this.updateById(id as TId, entity);
  };

  updateById = async (
    id: TId,
    patch: Partial<TEntity>,
  ): Promise<TEntity | null> => {
    const query = compilePostgresqlUpdate(id, patch, this.options);
    const result = await this.options.queryable.query<TEntity>(
      query.text,
      query.values,
    );

    return result.rows[0] ?? null;
  };

  delete = async (
    entityOrId: TEntity | TId,
  ): Promise<number> => {
    const id =
      typeof entityOrId === "object" && entityOrId !== null
        ? getPrimaryKeyValue(entityOrId, this.options)
        : entityOrId;

    return this.deleteById(id as TId);
  };

  deleteById = async (id: TId): Promise<number> => {
    const query = compilePostgresqlDeleteById(id, this.options);
    const result = await this.options.queryable.query(query.text, query.values);

    return result.rowCount ?? 0;
  };
}
