import {
  ColumnMetadata,
  EntityMetadata,
  getOptionalEntityMetadata,
  primaryColumnsOf,
  readRelationForeignKeyValue,
  relationJoinColumnName,
  RelationKind,
  RelationMetadata,
} from "@node-persistence-api/core";
import { PostgresqlQueryCompilerOptions } from "./types";

export function quoteTable(options: PostgresqlQueryCompilerOptions): string {
  const metadata = getMetadata(options);
  const tableName = options.tableName ?? metadata?.tableName;

  if (!tableName) {
    throw new Error("PostgreSQL repository requires tableName or entity metadata.");
  }

  const table = quoteQualifiedIdentifier(tableName);
  const schema = options.schema ?? metadata?.schema;

  if (!schema) {
    return table;
  }

  return `${quoteQualifiedIdentifier(schema)}.${table}`;
}

export function propertyToColumn(
  property: string,
  options: PostgresqlQueryCompilerOptions,
): string {
  return quoteIdentifier(propertyToColumnName(property, options));
}

export function propertyToColumnName(
  property: string,
  options: PostgresqlQueryCompilerOptions,
): string {
  return resolveColumnName(property, options);
}

export function primaryKeyProperty(
  options: PostgresqlQueryCompilerOptions,
): string {
  return options.primaryKey ?? primaryKeyProperties(options)[0] ?? "id";
}

export function primaryKeyProperties(
  options: PostgresqlQueryCompilerOptions,
): string[] {
  const metadata = getMetadata(options);
  const metadataPrimaryKeys = metadata
    ? primaryColumnsOf(metadata).map((column) => column.propertyName)
    : [];
  return metadataPrimaryKeys.length > 0 ? metadataPrimaryKeys : [options.primaryKey ?? "id"];
}

export function versionProperty(
  options: PostgresqlQueryCompilerOptions,
): string | undefined {
  return getMetadata(options)?.versionColumn?.propertyName;
}

export function entityColumnProperties(
  options: PostgresqlQueryCompilerOptions,
): string[] | undefined {
  const metadata = getMetadata(options);

  if (!metadata) {
    return undefined;
  }

  return [
    ...metadata.columns.map((column) => column.propertyName),
    ...metadata.relations
      .filter(isOwningToOneRelation)
      .map((relation) => relation.propertyName),
  ];
}

export function normalizePropertyValue(
  property: string,
  value: unknown,
  options: PostgresqlQueryCompilerOptions,
): unknown {
  const relation = getMetadata(options)?.relations.find(
    (candidate) => isOwningToOneRelation(candidate) && candidate.propertyName === property,
  );

  return relation ? readRelationForeignKeyValue(value, relation) : value;
}

function resolveColumnName(
  property: string,
  options: PostgresqlQueryCompilerOptions,
): string {
  return (
    options.columns?.[property] ??
    findColumn(property, options)?.columnName ??
    findOwningToOneRelation(property, options)?.joinColumn ??
    findRelationJoinColumnName(property, options) ??
    toSnakeCase(property)
  );
}

function findColumn(
  property: string,
  options: PostgresqlQueryCompilerOptions,
): ColumnMetadata | undefined {
  return getMetadata(options)?.columns.find(
    (column) => column.propertyName === property,
  );
}

function findOwningToOneRelation(
  property: string,
  options: PostgresqlQueryCompilerOptions,
) {
  return getMetadata(options)?.relations.find(
    (relation) => isOwningToOneRelation(relation) && relation.propertyName === property,
  );
}

function findRelationJoinColumnName(
  property: string,
  options: PostgresqlQueryCompilerOptions,
): string | undefined {
  const relation = findOwningToOneRelation(property, options);

  return relation ? relationJoinColumnName(relation) : undefined;
}

function isOwningToOneRelation(relation: RelationMetadata): boolean {
  return relation.kind === RelationKind.MANY_TO_ONE ||
    (relation.kind === RelationKind.ONE_TO_ONE && !relation.mappedBy);
}

function getMetadata(
  options: PostgresqlQueryCompilerOptions,
): EntityMetadata | undefined {
  return getOptionalEntityMetadata(options.entity);
}

export function quoteQualifiedIdentifier(identifier: string): string {
  return identifier.split(".").map(quoteIdentifier).join(".");
}

export function quoteIdentifier(identifier: string): string {
  if (identifier.length === 0) {
    throw new Error("PostgreSQL identifier must not be empty.");
  }

  return `"${identifier.replace(/"/g, '""')}"`;
}

export function toSnakeCase(value: string): string {
  return value.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
}
