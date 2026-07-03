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
import { MysqlQueryCompilerOptions } from "./types";

export function quoteMysqlTable(options: MysqlQueryCompilerOptions): string {
  const metadata = getMetadata(options);
  const tableName = options.tableName ?? metadata?.tableName;

  if (!tableName) {
    throw new Error("MySQL repository requires tableName or entity metadata.");
  }

  const table = quoteQualifiedIdentifier(tableName);
  const schema = options.schema ?? metadata?.schema;

  if (!schema) {
    return table;
  }

  return `${quoteQualifiedIdentifier(schema)}.${table}`;
}

export function mysqlPropertyToColumn(
  property: string,
  options: MysqlQueryCompilerOptions,
): string {
  return quoteIdentifier(mysqlPropertyToColumnName(property, options));
}

export function mysqlPropertyToColumnName(
  property: string,
  options: MysqlQueryCompilerOptions,
): string {
  return resolveColumnName(property, options);
}

export function mysqlPrimaryKeyProperty(
  options: MysqlQueryCompilerOptions,
): string {
  return options.primaryKey ?? mysqlPrimaryKeyProperties(options)[0] ?? "id";
}

export function mysqlPrimaryKeyProperties(
  options: MysqlQueryCompilerOptions,
): string[] {
  const metadata = getMetadata(options);
  const metadataPrimaryKeys = metadata
    ? primaryColumnsOf(metadata).map((column) => column.propertyName)
    : [];
  return metadataPrimaryKeys.length > 0 ? metadataPrimaryKeys : [options.primaryKey ?? "id"];
}

export function mysqlVersionProperty(
  options: MysqlQueryCompilerOptions,
): string | undefined {
  return getMetadata(options)?.versionColumn?.propertyName;
}

export function mysqlEntityColumnProperties(
  options: MysqlQueryCompilerOptions,
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

export function normalizeMysqlPropertyValue(
  property: string,
  value: unknown,
  options: MysqlQueryCompilerOptions,
): unknown {
  const relation = getMetadata(options)?.relations.find(
    (candidate) => isOwningToOneRelation(candidate) && candidate.propertyName === property,
  );

  return relation ? readRelationForeignKeyValue(value, relation) : value;
}

function resolveColumnName(
  property: string,
  options: MysqlQueryCompilerOptions,
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
  options: MysqlQueryCompilerOptions,
): ColumnMetadata | undefined {
  return getMetadata(options)?.columns.find(
    (column) => column.propertyName === property,
  );
}

function findOwningToOneRelation(
  property: string,
  options: MysqlQueryCompilerOptions,
) {
  return getMetadata(options)?.relations.find(
    (relation) => isOwningToOneRelation(relation) && relation.propertyName === property,
  );
}

function findRelationJoinColumnName(
  property: string,
  options: MysqlQueryCompilerOptions,
): string | undefined {
  const relation = findOwningToOneRelation(property, options);

  return relation ? relationJoinColumnName(relation) : undefined;
}

function isOwningToOneRelation(relation: RelationMetadata): boolean {
  return relation.kind === RelationKind.MANY_TO_ONE ||
    (relation.kind === RelationKind.ONE_TO_ONE && !relation.mappedBy);
}

function getMetadata(
  options: MysqlQueryCompilerOptions,
): EntityMetadata | undefined {
  return getOptionalEntityMetadata(options.entity);
}

export function quoteMysqlQualifiedIdentifier(identifier: string): string {
  return identifier.split(".").map(quoteIdentifier).join(".");
}

export function quoteMysqlIdentifier(identifier: string): string {
  if (identifier.length === 0) {
    throw new Error("MySQL identifier must not be empty.");
  }

  return `\`${identifier.replace(/`/g, "``")}\``;
}

function quoteQualifiedIdentifier(identifier: string): string {
  return quoteMysqlQualifiedIdentifier(identifier);
}

function quoteIdentifier(identifier: string): string {
  return quoteMysqlIdentifier(identifier);
}

function toSnakeCase(value: string): string {
  return value.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
}
