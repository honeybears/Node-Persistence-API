import {
  mysqlEntityColumnProperties,
  mysqlPrimaryKeyProperty,
  mysqlPropertyToColumn,
  quoteMysqlTable,
} from "./mysql-identifiers";
import { MysqlCompiledQuery, MysqlQueryCompilerOptions } from "./types";

export function compileMysqlInsert<TEntity extends object>(
  entity: TEntity,
  options: MysqlQueryCompilerOptions,
): MysqlCompiledQuery {
  const entries = definedEntries(entity, options).filter(
    ([property, value]) =>
      property !== mysqlPrimaryKeyProperty(options) ||
      (value !== null && value !== undefined),
  );

  if (entries.length === 0) {
    throw new Error("Cannot insert an entity without values.");
  }

  const columns = entries.map(([property]) => mysqlPropertyToColumn(property, options));
  const values = entries.map(([, value]) => value);
  const placeholders = values.map(() => "?");

  return {
    text: `INSERT INTO ${quoteMysqlTable(options)} (${columns.join(
      ", ",
    )}) VALUES (${placeholders.join(", ")})`,
    values,
  };
}

export function compileMysqlUpdate<TEntity extends object>(
  id: unknown,
  patch: TEntity,
  options: MysqlQueryCompilerOptions,
): MysqlCompiledQuery {
  assertId(id);

  const primaryKey = mysqlPrimaryKeyProperty(options);
  const entries = definedEntries(patch, options).filter(
    ([property]) => property !== primaryKey,
  );

  if (entries.length === 0) {
    throw new Error("Cannot update an entity without changed values.");
  }

  const values = entries.map(([, value]) => value);
  const assignments = entries.map(
    ([property]) => `${mysqlPropertyToColumn(property, options)} = ?`,
  );
  values.push(id);

  return {
    text: `UPDATE ${quoteMysqlTable(options)} SET ${assignments.join(
      ", ",
    )} WHERE ${mysqlPropertyToColumn(primaryKey, options)} = ?`,
    values,
  };
}

export function compileMysqlDeleteById(
  id: unknown,
  options: MysqlQueryCompilerOptions,
): MysqlCompiledQuery {
  assertId(id);

  return {
    text: `DELETE FROM ${quoteMysqlTable(options)} WHERE ${mysqlPropertyToColumn(
      mysqlPrimaryKeyProperty(options),
      options,
    )} = ?`,
    values: [id],
  };
}

export function compileMysqlFindById(
  id: unknown,
  options: MysqlQueryCompilerOptions,
): MysqlCompiledQuery {
  assertId(id);

  return {
    text: `SELECT * FROM ${quoteMysqlTable(options)} WHERE ${mysqlPropertyToColumn(
      mysqlPrimaryKeyProperty(options),
      options,
    )} = ? LIMIT 1`,
    values: [id],
  };
}

export function getMysqlPrimaryKeyValue<TEntity extends object>(
  entity: TEntity,
  options: MysqlQueryCompilerOptions,
): unknown {
  return (entity as Record<string, unknown>)[mysqlPrimaryKeyProperty(options)];
}

function definedEntries<TEntity extends object>(
  entity: TEntity,
  options: MysqlQueryCompilerOptions,
): Array<[string, unknown]> {
  const allowedProperties = mysqlEntityColumnProperties(options);
  return Object.entries(entity).filter(([property, value]) => {
    if (value === undefined) {
      return false;
    }

    return allowedProperties ? allowedProperties.includes(property) : true;
  });
}

function assertId(id: unknown): void {
  if (id === null || id === undefined) {
    throw new Error("Primary key value is required.");
  }
}
