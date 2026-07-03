import {
  defaultJoinTableName,
  EntityMetadata,
  getEntityMetadata,
  NPALoadOptions,
  NPARelationLoadTree,
  readEntityPrimaryValue,
  relationJoinColumnName,
  RelationKind,
  RelationMetadata,
  joinTableColumnName,
} from "@node-persistence-api/core";
import { quoteIdentifier, quoteQualifiedIdentifier } from "./postgresql-identifiers";
import { PostgresqlQueryable } from "./types";

export async function loadPostgresqlRelations<TEntity extends object>(
  entities: TEntity[],
  options: {
    entity?: new (...args: any[]) => TEntity;
    queryable: PostgresqlQueryable;
    load?: NPALoadOptions<TEntity>;
  },
): Promise<TEntity[]> {
  if (entities.length === 0 || !options.load?.relations) {
    return entities;
  }

  if (!options.entity) {
    throw new Error("PostgreSQL relation loading requires entity metadata.");
  }

  const metadata = getEntityMetadata(options.entity);
  const relationSelections = selectRelations(metadata, options.load.relations);

  for (const { relation, nested } of relationSelections) {
    let loaded: object[];

    if (relation.kind === RelationKind.MANY_TO_ONE) {
      loaded = await loadManyToOne(entities, metadata, relation, options.queryable);
    } else if (relation.kind === RelationKind.ONE_TO_MANY) {
      loaded = await loadOneToMany(entities, metadata, relation, options.queryable);
    } else if (relation.kind === RelationKind.MANY_TO_MANY) {
      loaded = await loadManyToMany(entities, metadata, relation, options.queryable);
    } else {
      loaded = [];
    }

    if (nested) {
      await loadPostgresqlRelations(loaded, {
        entity: relation.target() as new (...args: any[]) => object,
        load: { relations: nested },
        queryable: options.queryable,
      });
    }
  }

  return entities;
}

export function attachPostgresqlLazyRelations<TEntity extends object>(
  entities: TEntity[],
  options: {
    entity?: new (...args: any[]) => TEntity;
    queryable: PostgresqlQueryable;
  },
): TEntity[] {
  if (entities.length === 0) {
    return entities;
  }

  if (!options.entity) {
    return entities;
  }

  const metadata = getEntityMetadata(options.entity);

  for (const entity of entities) {
    for (const relation of metadata.relations) {
      if (Object.prototype.hasOwnProperty.call(entity, relation.propertyName)) {
        continue;
      }

      let cached: Promise<unknown> | undefined;
      Object.defineProperty(entity, relation.propertyName, {
        configurable: true,
        enumerable: false,
        get() {
          cached ??= loadPostgresqlRelations([entity], {
            entity: options.entity,
            load: { relations: [relation.propertyName] },
            queryable: options.queryable,
          }).then(() => readValue(entity, relation.propertyName));

          return cached;
        },
        set(value: unknown) {
          cached = Promise.resolve(value);
          Object.defineProperty(entity, relation.propertyName, {
            configurable: true,
            enumerable: true,
            value,
            writable: true,
          });
        },
      });
    }
  }

  return entities;
}

function selectRelations(
  metadata: EntityMetadata,
  requested: NonNullable<NPALoadOptions["relations"]>,
): Array<{ relation: RelationMetadata; nested?: NPARelationLoadTree }> {
  if (requested === true) {
    return metadata.relations.map((relation) => ({ relation }));
  }

  if (Array.isArray(requested)) {
    return requested.map((propertyName) => {
      const relation = findRelation(metadata, propertyName);

      return { relation };
    });
  }

  const relationTree = requested as Record<string, true | NPARelationLoadTree>;

  return Object.entries(relationTree).map(([propertyName, nested]) => {
    const relation = findRelation(metadata, propertyName);

    return {
      relation,
      nested: nested === true ? undefined : nested,
    };
  });
}

function findRelation(
  metadata: EntityMetadata,
  propertyName: string,
): RelationMetadata {
    const relation = metadata.relations.find((candidate) =>
      candidate.propertyName === propertyName,
    );

    if (!relation) {
      throw new Error(`Entity ${metadata.target.name} has no relation ${propertyName}.`);
    }

    return relation;
}

function flattenRelationValues(entities: object[], relation: RelationMetadata): object[] {
  return entities.flatMap((entity) => {
    const value = readValue(entity, relation.propertyName);
    return Array.isArray(value) ? value : value ? [value] : [];
  }) as object[];
}

async function loadManyToOne<TEntity extends object>(
  entities: TEntity[],
  _metadata: EntityMetadata,
  relation: RelationMetadata,
  queryable: PostgresqlQueryable,
): Promise<object[]> {
  const targetMetadata = getEntityMetadata(relation.target());
  const targetPrimary = requirePrimaryColumn(targetMetadata);
  const joinColumn = relationJoinColumnName(relation);
  const ids = uniqueValues(entities.map((entity) => readValue(entity, joinColumn)));

  if (ids.length === 0) {
    for (const entity of entities) {
      writeValue(entity, relation.propertyName, null);
    }
    return [];
  }

  const rows = await selectRowsByColumn(
    queryable,
    targetMetadata,
    targetPrimary.columnName,
    ids,
  );
  const rowById = new Map(rows.map((row) => [readValue(row, targetPrimary.columnName), row]));

  for (const entity of entities) {
    const id = readValue(entity, joinColumn);
    writeValue(entity, relation.propertyName, rowById.get(id) ?? null);
  }

  return flattenRelationValues(entities, relation);
}

async function loadOneToMany<TEntity extends object>(
  entities: TEntity[],
  metadata: EntityMetadata,
  relation: RelationMetadata,
  queryable: PostgresqlQueryable,
): Promise<object[]> {
  if (!relation.mappedBy) {
    throw new Error(`@OneToMany ${metadata.target.name}.${relation.propertyName} requires mappedBy.`);
  }

  const targetMetadata = getEntityMetadata(relation.target());
  const targetRelation = targetMetadata.relations.find((candidate) =>
    candidate.kind === RelationKind.MANY_TO_ONE && candidate.propertyName === relation.mappedBy,
  );

  if (!targetRelation) {
    throw new Error(`@OneToMany ${metadata.target.name}.${relation.propertyName} mappedBy relation was not found.`);
  }

  const sourceIds = uniqueValues(entities.map((entity) => readEntityPrimaryValue(entity, metadata)));
  const joinColumn = relationJoinColumnName(targetRelation);
  const rows = await selectRowsByColumn(queryable, targetMetadata, joinColumn, sourceIds);
  const rowsBySourceId = groupRows(rows, joinColumn);

  for (const entity of entities) {
    const id = readEntityPrimaryValue(entity, metadata);
    writeValue(entity, relation.propertyName, rowsBySourceId.get(id) ?? []);
  }

  return flattenRelationValues(entities, relation);
}

async function loadManyToMany<TEntity extends object>(
  entities: TEntity[],
  metadata: EntityMetadata,
  relation: RelationMetadata,
  queryable: PostgresqlQueryable,
): Promise<object[]> {
  const targetMetadata = getEntityMetadata(relation.target());
  const sourceIds = uniqueValues(entities.map((entity) => readEntityPrimaryValue(entity, metadata)));

  if (sourceIds.length === 0) {
    return [];
  }

  const join = manyToManyJoin(metadata, relation);
  const targetPrimary = requirePrimaryColumn(targetMetadata);
  const placeholders = sourceIds.map((_, index) => `$${index + 1}`).join(", ");
  const result = await queryable.query<Record<string, unknown>>(
    [
      `SELECT j.${quoteIdentifier(join.currentColumn)} AS "__npa_source_id", t.*`,
      `FROM ${join.table} j`,
      `JOIN ${qualifiedTable(targetMetadata)} t ON t.${quoteIdentifier(targetPrimary.columnName)} = j.${quoteIdentifier(join.relatedColumn)}`,
      `WHERE j.${quoteIdentifier(join.currentColumn)} IN (${placeholders})`,
    ].join("\n"),
    sourceIds,
  );
  const rowsBySourceId = groupRows(result.rows, "__npa_source_id", {
    omitGroupColumn: true,
  });

  for (const entity of entities) {
    const id = readEntityPrimaryValue(entity, metadata);
    writeValue(entity, relation.propertyName, rowsBySourceId.get(id) ?? []);
  }

  return flattenRelationValues(entities, relation);
}

interface ManyToManyJoin {
  table: string;
  currentColumn: string;
  relatedColumn: string;
}

function manyToManyJoin(
  source: EntityMetadata,
  relation: RelationMetadata,
): ManyToManyJoin {
  const target = getEntityMetadata(relation.target());

  if (relation.mappedBy) {
    const owner = target.relations.find((candidate) =>
      candidate.kind === RelationKind.MANY_TO_MANY &&
      candidate.propertyName === relation.mappedBy,
    );

    if (!owner) {
      throw new Error(`@ManyToMany ${source.target.name}.${relation.propertyName} mappedBy relation was not found.`);
    }

    return {
      table: qualifiedJoinTable(target, source, owner),
      currentColumn: joinTableColumnName(source),
      relatedColumn: joinTableColumnName(target),
    };
  }

  return {
    table: qualifiedJoinTable(source, target, relation),
    currentColumn: joinTableColumnName(source),
    relatedColumn: joinTableColumnName(target),
  };
}

async function selectRowsByColumn(
  queryable: PostgresqlQueryable,
  metadata: EntityMetadata,
  columnName: string,
  values: unknown[],
): Promise<Record<string, unknown>[]> {
  if (values.length === 0) {
    return [];
  }

  const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
  const result = await queryable.query<Record<string, unknown>>(
    `SELECT * FROM ${qualifiedTable(metadata)} WHERE ${quoteIdentifier(columnName)} IN (${placeholders})`,
    values,
  );

  return result.rows;
}

function groupRows(
  rows: Record<string, unknown>[],
  columnName: string,
  options: { omitGroupColumn?: boolean } = {},
): Map<unknown, Record<string, unknown>[]> {
  const grouped = new Map<unknown, Record<string, unknown>[]>();

  for (const row of rows) {
    const key = readValue(row, columnName);
    const current = grouped.get(key) ?? [];
    current.push(options.omitGroupColumn ? omitProperty(row, columnName) : row);
    grouped.set(key, current);
  }

  return grouped;
}

function omitProperty(
  row: Record<string, unknown>,
  propertyName: string,
): Record<string, unknown> {
  const { [propertyName]: _omitted, ...rest } = row;
  return rest;
}

function qualifiedTable(metadata: EntityMetadata): string {
  const table = quoteQualifiedIdentifier(metadata.tableName);
  return metadata.schema ? `${quoteQualifiedIdentifier(metadata.schema)}.${table}` : table;
}

function qualifiedJoinTable(
  source: EntityMetadata,
  target: EntityMetadata,
  relation: RelationMetadata,
): string {
  const rawName = relation.joinTable ?? defaultJoinTableName(source, target);
  const separatorIndex = rawName.indexOf(".");

  if (separatorIndex > 0) {
    return `${quoteQualifiedIdentifier(rawName.slice(0, separatorIndex))}.${quoteQualifiedIdentifier(rawName.slice(separatorIndex + 1))}`;
  }

  const table = quoteQualifiedIdentifier(rawName);
  const schema = source.schema ?? target.schema;
  return schema ? `${quoteQualifiedIdentifier(schema)}.${table}` : table;
}

function requirePrimaryColumn(metadata: EntityMetadata) {
  if (!metadata.primaryColumn) {
    throw new Error(`Entity ${metadata.target.name} requires an @Id column.`);
  }

  return metadata.primaryColumn;
}

function uniqueValues(values: unknown[]): unknown[] {
  return [...new Set(values.filter((value) => value !== null && value !== undefined))];
}

function readValue(entity: object, propertyOrColumn: string): unknown {
  return (entity as Record<string, unknown>)[propertyOrColumn];
}

function writeValue(entity: object, propertyName: string, value: unknown): void {
  (entity as Record<string, unknown>)[propertyName] = value;
}
