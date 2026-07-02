import type {
  NPARelationLoad,
  NPARelationLoadTree,
} from "./relation-load-types";

export type NPAEntityGraphRelations<TEntity extends object = object> =
  NPARelationLoad<TEntity>;

export interface NPAEntityGraphMetadata<TEntity extends object = object> {
  relations: NPAEntityGraphRelations<TEntity>;
}

export interface NPAEntityGraphOptions<TEntity extends object = object> {
  relations: NPAEntityGraphRelations<TEntity>;
}

const entityGraphMetadata = new WeakMap<
  object,
  Map<PropertyKey, NPAEntityGraphMetadata>
>();

export function EntityGraph<TEntity extends object = object>(
  options:
    | NPAEntityGraphOptions<TEntity>
    | NPAEntityGraphRelations<TEntity>
    | string,
): MethodDecorator & PropertyDecorator {
  const metadata = normalizeEntityGraphOptions(options);

  return (target: object, propertyKey: string | symbol) => {
    let targetMetadata = entityGraphMetadata.get(target);

    if (!targetMetadata) {
      targetMetadata = new Map();
      entityGraphMetadata.set(target, targetMetadata);
    }

    targetMetadata.set(propertyKey, metadata);
  };
}

export function defineEntityGraph<
  TEntity extends object,
  const TRelations extends NPAEntityGraphRelations<TEntity> = NPAEntityGraphRelations<TEntity>,
>(relations: TRelations): TRelations {
  return relations;
}

export function getEntityGraphMetadata(
  target: object,
  propertyKey: PropertyKey,
): NPAEntityGraphMetadata | undefined {
  let current: object | null = target;

  while (current) {
    const metadata = entityGraphMetadata.get(current)?.get(propertyKey);

    if (metadata) {
      return cloneEntityGraphMetadata(metadata);
    }

    current = Object.getPrototypeOf(current);
  }

  return undefined;
}

function normalizeEntityGraphOptions<TEntity extends object>(
  options:
    | NPAEntityGraphOptions<TEntity>
    | NPAEntityGraphRelations<TEntity>
    | string,
): NPAEntityGraphMetadata {
  if (typeof options === "string") {
    return { relations: [options] };
  }

  if (Array.isArray(options) || options === true) {
    return { relations: options };
  }

  if (isEntityGraphOptions(options)) {
    return { relations: options.relations };
  }

  return { relations: options };
}

function cloneEntityGraphMetadata(
  metadata: NPAEntityGraphMetadata,
): NPAEntityGraphMetadata {
  return {
    relations: cloneRelations(metadata.relations),
  };
}

function cloneRelations(
  relations: NPAEntityGraphRelations,
): NPAEntityGraphRelations {
  if (relations === true) {
    return true;
  }

  if (Array.isArray(relations)) {
    return [...relations];
  }

  return Object.fromEntries(
    Object.entries(relations as NPARelationLoadTree).map(([propertyName, nested]) => [
      propertyName,
      nested === true ? true : cloneRelationTree(nested as NPARelationLoadTree),
    ]),
  );
}

function cloneRelationTree(tree: NPARelationLoadTree): NPARelationLoadTree {
  return Object.fromEntries(
    Object.entries(tree).map(([propertyName, nested]) => [
      propertyName,
      nested === true ? true : cloneRelationTree(nested as NPARelationLoadTree),
    ]),
  );
}

function isEntityGraphOptions<TEntity extends object>(
  options:
    | NPAEntityGraphOptions<TEntity>
    | NPAEntityGraphRelations<TEntity>,
): options is NPAEntityGraphOptions<TEntity> {
  return (
    typeof options === "object" &&
    options !== null &&
    !Array.isArray(options) &&
    Object.prototype.hasOwnProperty.call(options, "relations")
  );
}
