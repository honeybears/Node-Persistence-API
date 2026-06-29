import {
  ColumnMetadata,
  ColumnOptions,
  EntityMetadata,
  EntityOptions,
  EntityTarget,
  RelationKind,
  RelationMetadata,
  RelationOptions,
} from "./types";

interface MutableEntityMetadata {
  target: EntityTarget;
  tableName?: string;
  schema?: string;
  columns: Map<string, ColumnMetadata>;
  relations: Map<string, RelationMetadata>;
  primaryColumn?: ColumnMetadata;
}

const metadataByTarget = new WeakMap<EntityTarget, MutableEntityMetadata>();

export function registerEntity(
  target: EntityTarget,
  options: EntityOptions = {},
): void {
  const metadata = getOrCreateMutableMetadata(target);
  metadata.tableName = options.name ?? metadata.tableName ?? toSnakeCase(target.name);
  metadata.schema = options.schema ?? metadata.schema;
}

export function registerColumn(
  target: object,
  propertyKey: string | symbol,
  options: ColumnOptions = {},
): void {
  const metadata = getOrCreateMutableMetadata(target.constructor as EntityTarget);
  const propertyName = toPropertyName(propertyKey);

  metadata.columns.set(propertyName, {
    propertyName,
    columnName: options.name ?? toSnakeCase(propertyName),
    nullable: options.nullable ?? false,
    type: options.type,
    primary: false,
  });
}

export function registerId(
  target: object,
  propertyKey: string | symbol,
  options: ColumnOptions = {},
): void {
  const metadata = getOrCreateMutableMetadata(target.constructor as EntityTarget);
  const propertyName = toPropertyName(propertyKey);
  const column: ColumnMetadata = {
    propertyName,
    columnName: options.name ?? toSnakeCase(propertyName),
    nullable: false,
    type: options.type,
    primary: true,
  };

  metadata.columns.set(propertyName, column);
  metadata.primaryColumn = column;
}

export function registerRelation(
  target: object,
  propertyKey: string | symbol,
  kind: RelationKind,
  relationTarget: () => EntityTarget,
  options: RelationOptions = {},
): void {
  const metadata = getOrCreateMutableMetadata(target.constructor as EntityTarget);
  const propertyName = toPropertyName(propertyKey);

  metadata.relations.set(propertyName, {
    propertyName,
    kind,
    target: relationTarget,
    mappedBy: options.mappedBy,
    inversedBy: options.inversedBy,
    joinColumn: options.joinColumn,
    joinTable: options.joinTable,
  });
}

export function getEntityMetadata<TEntity extends object>(
  target: EntityTarget<TEntity>,
): EntityMetadata {
  const metadata = metadataByTarget.get(target);

  if (!metadata?.tableName) {
    throw new Error(`Entity metadata for "${target.name}" was not registered.`);
  }

  return {
    target,
    tableName: metadata.tableName,
    schema: metadata.schema,
    columns: [...metadata.columns.values()],
    relations: [...metadata.relations.values()],
    primaryColumn: metadata.primaryColumn,
  };
}

export function getOptionalEntityMetadata<TEntity extends object>(
  target: EntityTarget<TEntity> | undefined,
): EntityMetadata | undefined {
  return target ? getEntityMetadata(target) : undefined;
}

function getOrCreateMutableMetadata(
  target: EntityTarget,
): MutableEntityMetadata {
  const current = metadataByTarget.get(target);

  if (current) {
    return current;
  }

  const metadata: MutableEntityMetadata = {
    target,
    tableName: undefined,
    schema: undefined,
    columns: new Map(),
    relations: new Map(),
    primaryColumn: undefined,
  };
  metadataByTarget.set(target, metadata);

  return metadata;
}

function toPropertyName(propertyKey: string | symbol): string {
  if (typeof propertyKey === "symbol") {
    throw new Error("Symbol properties are not supported as entity fields.");
  }

  return propertyKey;
}

function toSnakeCase(value: string): string {
  return value.replace(/[A-Z]/g, (match, index) =>
    `${index === 0 ? "" : "_"}${match.toLowerCase()}`,
  );
}
