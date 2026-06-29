import {
  PostgresqlCompiledQuery,
  PostgresqlQueryCompilerOptions,
} from "./types";
import {
  entityColumnProperties,
  primaryKeyProperty as resolvePrimaryKeyProperty,
  propertyToColumn,
  quoteTable,
} from "./postgresql-identifiers";

export function compilePostgresqlInsert<TEntity extends object>(
  entity: TEntity,
  options: PostgresqlQueryCompilerOptions,
): PostgresqlCompiledQuery {
  const entries = definedEntries(entity, options).filter(
    ([property, value]) =>
      property !== resolvePrimaryKeyProperty(options) ||
      (value !== null && value !== undefined),
  );

  if (entries.length === 0) {
    throw new Error("Cannot insert an entity without values.");
  }

  const columns = entries.map(([property]) => propertyToColumn(property, options));
  const values = entries.map(([, value]) => value);
  const placeholders = values.map((_, index) => `$${index + 1}`);

  return {
    text: `INSERT INTO ${quoteTable(options)} (${columns.join(
      ", ",
    )}) VALUES (${placeholders.join(", ")}) RETURNING *`,
    values,
  };
}

export function compilePostgresqlUpdate<TEntity extends object>(
  id: unknown,
  patch: TEntity,
  options: PostgresqlQueryCompilerOptions,
): PostgresqlCompiledQuery {
  assertId(id);

  const primaryKey = resolvePrimaryKeyProperty(options);
  const entries = definedEntries(patch, options).filter(
    ([property]) => property !== primaryKey,
  );

  if (entries.length === 0) {
    throw new Error("Cannot update an entity without changed values.");
  }

  const values = entries.map(([, value]) => value);
  const assignments = entries.map(
    ([property], index) => `${propertyToColumn(property, options)} = $${index + 1}`,
  );
  values.push(id);

  return {
    text: `UPDATE ${quoteTable(options)} SET ${assignments.join(
      ", ",
    )} WHERE ${propertyToColumn(primaryKey, options)} = $${
      values.length
    } RETURNING *`,
    values,
  };
}

export function compilePostgresqlDeleteById(
  id: unknown,
  options: PostgresqlQueryCompilerOptions,
): PostgresqlCompiledQuery {
  assertId(id);

  return {
    text: `DELETE FROM ${quoteTable(options)} WHERE ${propertyToColumn(
      primaryKeyProperty(options),
      options,
    )} = $1`,
    values: [id],
  };
}

export function primaryKeyProperty(
  options: PostgresqlQueryCompilerOptions,
): string {
  return resolvePrimaryKeyProperty(options);
}

export function getPrimaryKeyValue<TEntity extends object>(
  entity: TEntity,
  options: PostgresqlQueryCompilerOptions,
): unknown {
  return (entity as Record<string, unknown>)[resolvePrimaryKeyProperty(options)];
}

function definedEntries<TEntity extends object>(
  entity: TEntity,
  options: PostgresqlQueryCompilerOptions,
): Array<[string, unknown]> {
  const allowedProperties = entityColumnProperties(options);
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
