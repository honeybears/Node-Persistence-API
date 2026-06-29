import { NPARepositoryAdapter, RepositoryMethodExecutor } from "../repository";
import {
  compileMysqlDeleteById,
  compileMysqlFindById,
  compileMysqlInsert,
  compileMysqlUpdate,
  getMysqlPrimaryKeyValue,
} from "./mysql-crud-compiler";
import { compileMysqlQuery } from "./mysql-query-compiler";
import { executeMysqlQuery } from "./mysql-result";
import { MysqlRepositoryOptions } from "./types";

export class MysqlRepositoryExecutor<TEntity extends object, TId = unknown>
  implements NPARepositoryAdapter<TEntity, TId>
{
  constructor(private readonly options: MysqlRepositoryOptions) {}

  executeDerivedQuery: RepositoryMethodExecutor<Promise<unknown>> = async (
    invocation,
  ) => {
    const query = compileMysqlQuery(invocation, this.options);
    const result = await executeMysqlQuery(
      this.options,
      query.text,
      query.values,
    );

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
        return result.affectedRows ?? 0;
    }
  };

  save = async (entity: TEntity): Promise<TEntity | null> => {
    const id = getMysqlPrimaryKeyValue(entity, this.options);
    return id === null || id === undefined
      ? this.insert(entity)
      : this.update(entity);
  };

  insert = async (entity: TEntity): Promise<TEntity> => {
    const query = compileMysqlInsert(entity, this.options);
    const result = await executeMysqlQuery<TEntity>(
      this.options,
      query.text,
      query.values,
    );
    const id = getMysqlPrimaryKeyValue(entity, this.options) ?? result.insertId;

    if (id === null || id === undefined) {
      return entity;
    }

    return (await this.findById(id)) ?? entity;
  };

  update = async (entity: TEntity): Promise<TEntity | null> => {
    const id = getMysqlPrimaryKeyValue(entity, this.options);
    return this.updateById(id as TId, entity);
  };

  updateById = async (
    id: TId,
    patch: Partial<TEntity>,
  ): Promise<TEntity | null> => {
    const query = compileMysqlUpdate(id, patch, this.options);
    const result = await executeMysqlQuery<TEntity>(
      this.options,
      query.text,
      query.values,
    );

    if (result.affectedRows === 0) {
      return null;
    }

    return this.findById(id);
  };

  delete = async (entityOrId: TEntity | TId): Promise<number> => {
    const id =
      typeof entityOrId === "object" && entityOrId !== null
        ? getMysqlPrimaryKeyValue(entityOrId, this.options)
        : entityOrId;

    return this.deleteById(id as TId);
  };

  deleteById = async (id: TId): Promise<number> => {
    const query = compileMysqlDeleteById(id, this.options);
    const result = await executeMysqlQuery(this.options, query.text, query.values);

    return result.affectedRows ?? 0;
  };

  private findById = async (id: unknown): Promise<TEntity | null> => {
    const query = compileMysqlFindById(id, this.options);
    const result = await executeMysqlQuery<TEntity>(
      this.options,
      query.text,
      query.values,
    );

    return result.rows[0] ?? null;
  };
}
