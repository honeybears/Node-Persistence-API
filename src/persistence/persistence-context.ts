import {
  ColumnMetadata,
  EntityMetadata,
  getEntityMetadata,
  readRelationForeignKeyValue,
  relationJoinColumnName,
  RelationKind,
  RelationMetadata,
} from "../entity";
import { OptimisticLockError } from "./optimistic-lock-error";
import { NPADirtyCheckAdapter, NPAManageEntityOptions } from "./types";

type EntitySnapshot = Map<string, unknown>;

interface ManagedEntity<TEntity extends object = object> {
  adapter: NPADirtyCheckAdapter<TEntity>;
  entity: TEntity;
  metadata: EntityMetadata;
  snapshot: EntitySnapshot;
}

export class PersistenceContext {
  private readonly managed = new Map<object, ManagedEntity>();
  private identityMap = new WeakMap<
    NPADirtyCheckAdapter,
    WeakMap<object, Map<unknown, ManagedEntity>>
  >();

  manage<TEntity extends object>(
    entity: TEntity,
    options: NPAManageEntityOptions<TEntity>,
  ): TEntity;
  manage<TEntity extends object>(
    entity: null,
    options: NPAManageEntityOptions<TEntity>,
  ): null;
  manage<TEntity extends object>(
    entity: undefined,
    options: NPAManageEntityOptions<TEntity>,
  ): undefined;
  manage<TEntity extends object>(
    entity: TEntity | null | undefined,
    options: NPAManageEntityOptions<TEntity>,
  ): TEntity | null | undefined {
    if (!entity) {
      return entity;
    }

    const metadata = getEntityMetadata(options.entity);
    const primaryColumn = requirePrimaryColumn(metadata);
    installColumnAliases(entity, metadata);
    const id = readColumnValue(entity, primaryColumn);
    const existing = id === null || id === undefined
      ? undefined
      : this.findByIdentity(options.adapter, metadata.target, id);

    if (existing) {
      mergeManagedEntity(existing, entity);
      return existing.entity as TEntity;
    }

    const managed = {
      adapter: options.adapter,
      entity,
      metadata,
      snapshot: snapshotEntity(entity, metadata),
    };
    this.managed.set(entity, managed);
    this.rememberIdentity(options.adapter, metadata.target, id, managed);

    return entity;
  }

  findManagedById<TEntity extends object>(
    id: unknown,
    options: NPAManageEntityOptions<TEntity>,
  ): TEntity | undefined {
    const metadata = getEntityMetadata(options.entity);
    return this.findByIdentity(options.adapter, metadata.target, id)?.entity as
      | TEntity
      | undefined;
  }

  manageMany<TEntity extends object>(
    entities: TEntity[],
    options: NPAManageEntityOptions<TEntity>,
  ): TEntity[] {
    return entities.map((entity) => this.manage(entity, options));
  }

  detach(entity: object | null | undefined): void {
    if (entity) {
      this.detachManagedEntity(entity);
    }
  }

  detachById<TEntity extends object>(
    id: unknown,
    options: NPAManageEntityOptions<TEntity>,
  ): void {
    const metadata = getEntityMetadata(options.entity);
    const primaryColumn = requirePrimaryColumn(metadata);

    for (const [entity, managed] of this.managed.entries()) {
      if (!isSameManagedEntity(managed, metadata, options.adapter)) {
        continue;
      }

      if (Object.is(readColumnValue(managed.entity, primaryColumn), id)) {
        this.detachManagedEntity(entity);
      }
    }
  }

  detachAll<TEntity extends object>(
    options?: NPAManageEntityOptions<TEntity>,
  ): void {
    if (!options) {
      this.clear();
      return;
    }

    const metadata = getEntityMetadata(options.entity);

    for (const [entity, managed] of this.managed.entries()) {
      if (isSameManagedEntity(managed, metadata, options.adapter)) {
        this.detachManagedEntity(entity);
      }
    }
  }

  clear(): void {
    this.managed.clear();
    this.identityMap = new WeakMap();
  }

  async flush(): Promise<void> {
    for (const managed of [...this.managed.values()]) {
      const patch = diffEntity(managed.entity, managed.snapshot, managed.metadata);

      if (Object.keys(patch).length === 0) {
        continue;
      }

      const primaryColumn = requirePrimaryColumn(managed.metadata);
      const id = readColumnValue(managed.entity, primaryColumn);

      if (id === null || id === undefined) {
        throw new Error(
          `Cannot flush dirty entity "${managed.metadata.target.name}" without a primary key value.`,
        );
      }

      const versionColumn = managed.metadata.versionColumn;
      const expectedVersion = versionColumn
        ? managed.snapshot.get(versionColumn.propertyName)
        : undefined;

      if (versionColumn && (expectedVersion === null || expectedVersion === undefined)) {
        throw new Error(
          `Cannot flush versioned entity "${managed.metadata.target.name}" without a version value.`,
        );
      }

      const updated = await managed.adapter.updateDirty(managed.entity, id, patch, {
        expectedVersion,
        versionColumn,
      });

      if (!updated && versionColumn) {
        throw new OptimisticLockError(
          managed.metadata.target.name,
          id,
          expectedVersion,
        );
      }

      if (updated && versionColumn) {
        writeColumnValue(
          managed.entity,
          versionColumn,
          readColumnValue(updated, versionColumn),
        );
      }

      if (updated && managed.metadata.updatedAtColumn) {
        const updatedAt = readColumnValue(updated, managed.metadata.updatedAtColumn);

        if (updatedAt !== undefined) {
          writeColumnValue(
            managed.entity,
            managed.metadata.updatedAtColumn,
            updatedAt,
          );
        }
      }

      managed.snapshot = snapshotEntity(managed.entity, managed.metadata);
    }
  }

  private findByIdentity(
    adapter: NPADirtyCheckAdapter,
    entity: object,
    id: unknown,
  ): ManagedEntity | undefined {
    return this.identityMap.get(adapter)?.get(entity)?.get(id);
  }

  private rememberIdentity(
    adapter: NPADirtyCheckAdapter,
    entity: object,
    id: unknown,
    managed: ManagedEntity,
  ): void {
    if (id === null || id === undefined) {
      return;
    }

    let entityMap = this.identityMap.get(adapter);

    if (!entityMap) {
      entityMap = new WeakMap();
      this.identityMap.set(adapter, entityMap);
    }

    let idMap = entityMap.get(entity);

    if (!idMap) {
      idMap = new Map();
      entityMap.set(entity, idMap);
    }

    idMap.set(id, managed);
  }

  private detachManagedEntity(entity: object): void {
    const managed = this.managed.get(entity);

    if (!managed) {
      return;
    }

    const primaryColumn = requirePrimaryColumn(managed.metadata);
    const id = readColumnValue(managed.entity, primaryColumn);
    this.identityMap.get(managed.adapter)?.get(managed.metadata.target)?.delete(id);
    this.managed.delete(entity);
  }
}

function diffEntity<TEntity extends object>(
  entity: TEntity,
  snapshot: EntitySnapshot,
  metadata: EntityMetadata,
): Partial<TEntity> {
  const patch = {} as Partial<TEntity>;
  const patchRecord = patch as Record<string, unknown>;

  for (const column of metadata.columns) {
    if (column.primary || column.version) {
      continue;
    }

    const currentValue = readColumnValue(entity, column);

    if (currentValue === undefined) {
      continue;
    }

    if (!isSameValue(currentValue, snapshot.get(column.propertyName))) {
      patchRecord[column.propertyName] = currentValue;
    }
  }

  for (const relation of metadata.relations) {
    if (relation.kind !== RelationKind.MANY_TO_ONE) {
      continue;
    }

    const currentValue = readRelationForeignKey(entity, relation);

    if (currentValue === undefined) {
      continue;
    }

    if (!isSameValue(currentValue, snapshot.get(relation.propertyName))) {
      patchRecord[relation.propertyName] = currentValue;
    }
  }

  return patch;
}

function snapshotEntity(
  entity: object,
  metadata: EntityMetadata,
): EntitySnapshot {
  return new Map([
    ...metadata.columns.map((column) => [
      column.propertyName,
      snapshotValue(readColumnValue(entity, column)),
    ] as const),
    ...metadata.relations
      .filter((relation) => relation.kind === RelationKind.MANY_TO_ONE)
      .map((relation) => [
        relation.propertyName,
        snapshotValue(readRelationForeignKey(entity, relation)),
      ] as const),
  ]);
}

function mergeManagedEntity<TEntity extends object>(
  managed: ManagedEntity<TEntity>,
  incoming: TEntity,
): void {
  const wasDirty =
    Object.keys(diffEntity(managed.entity, managed.snapshot, managed.metadata))
      .length > 0;

  mergeLoadedRelations(managed.entity, incoming, managed.metadata);

  if (wasDirty) {
    return;
  }

  mergeDatabaseValues(managed.entity, incoming, managed.metadata);
  managed.snapshot = snapshotEntity(managed.entity, managed.metadata);
}

function mergeDatabaseValues(
  target: object,
  source: object,
  metadata: EntityMetadata,
): void {
  for (const column of metadata.columns) {
    const value = readColumnValue(source, column);

    if (value !== undefined) {
      writeColumnValue(target, column, value);
    }
  }

  for (const relation of metadata.relations) {
    if (relation.kind !== RelationKind.MANY_TO_ONE) {
      continue;
    }

    const value = readRelationForeignKey(source, relation);

    if (value !== undefined) {
      writeRawValue(target, relationJoinColumnName(relation), value);
    }
  }
}

function mergeLoadedRelations(
  target: object,
  source: object,
  metadata: EntityMetadata,
): void {
  for (const relation of metadata.relations) {
    const property = readOwnDataProperty(source, relation.propertyName);

    if (!property.found) {
      continue;
    }

    writeRawValue(target, relation.propertyName, property.value);
  }
}

function readRelationForeignKey(
  entity: object,
  relation: RelationMetadata,
): unknown {
  const property = readOwnDataProperty(entity, relation.propertyName);

  if (property.found) {
    return readRelationForeignKeyValue(property.value, relation);
  }

  return readPropertyValue(entity, relationJoinColumnName(relation));
}

function readOwnDataProperty(
  entity: object,
  propertyName: string,
): { found: true; value: unknown } | { found: false } {
  const descriptor = Object.getOwnPropertyDescriptor(entity, propertyName);

  if (!descriptor || !("value" in descriptor)) {
    return { found: false };
  }

  return { found: true, value: descriptor.value };
}

function readPropertyValue(entity: object, propertyName: string): unknown {
  return (entity as Record<string, unknown>)[propertyName];
}

function readColumnValue(entity: object, column: ColumnMetadata): unknown {
  const record = entity as Record<string, unknown>;

  if (column.propertyName in record) {
    return record[column.propertyName];
  }

  return record[column.columnName];
}

function writeColumnValue(
  entity: object,
  column: ColumnMetadata,
  value: unknown,
): void {
  const record = entity as Record<string, unknown>;

  if (column.propertyName in record) {
    record[column.propertyName] = value;
    return;
  }

  record[column.columnName] = value;
}

function writeRawValue(
  entity: object,
  propertyName: string,
  value: unknown,
): void {
  (entity as Record<string, unknown>)[propertyName] = value;
}

function installColumnAliases(
  entity: object,
  metadata: EntityMetadata,
): void {
  const record = entity as Record<string, unknown>;

  for (const column of metadata.columns) {
    if (column.propertyName === column.columnName) {
      continue;
    }

    if (column.propertyName in record || !(column.columnName in record)) {
      continue;
    }

    Object.defineProperty(entity, column.propertyName, {
      configurable: true,
      enumerable: false,
      get() {
        return (this as Record<string, unknown>)[column.columnName];
      },
      set(value: unknown) {
        (this as Record<string, unknown>)[column.columnName] = value;
      },
    });
  }
}

function requirePrimaryColumn(metadata: EntityMetadata): ColumnMetadata {
  if (!metadata.primaryColumn) {
    throw new Error(
      `Entity "${metadata.target.name}" requires an @Id column for dirty checking.`,
    );
  }

  return metadata.primaryColumn;
}

function isSameManagedEntity(
  managed: ManagedEntity,
  metadata: EntityMetadata,
  adapter: NPADirtyCheckAdapter,
): boolean {
  return managed.metadata.target === metadata.target && managed.adapter === adapter;
}

function snapshotValue(value: unknown): unknown {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  return value;
}

function isSameValue(currentValue: unknown, snapshotValue: unknown): boolean {
  if (currentValue instanceof Date && snapshotValue instanceof Date) {
    return currentValue.getTime() === snapshotValue.getTime();
  }

  return Object.is(currentValue, snapshotValue);
}
