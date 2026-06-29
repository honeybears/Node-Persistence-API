import {
  registerColumn,
  registerEntity,
  registerId,
  registerRelation,
} from "./metadata-storage";
import {
  ColumnOptions,
  EntityOptions,
  EntityTarget,
  RelationOptions,
} from "./types";

export function Entity(options: EntityOptions | string = {}): ClassDecorator {
  const resolvedOptions = typeof options === "string" ? { name: options } : options;

  return (target) => {
    registerEntity(target as unknown as EntityTarget, resolvedOptions);
  };
}

export function Id(options: ColumnOptions | string = {}): PropertyDecorator {
  const resolvedOptions = normalizeColumnOptions(options);

  return (target, propertyKey) => {
    registerId(target, propertyKey, resolvedOptions);
  };
}

export function Column(options: ColumnOptions | string = {}): PropertyDecorator {
  const resolvedOptions = normalizeColumnOptions(options);

  return (target, propertyKey) => {
    registerColumn(target, propertyKey, resolvedOptions);
  };
}

export function OneToMany(
  target: () => EntityTarget,
  options: RelationOptions = {},
): PropertyDecorator {
  return (source, propertyKey) => {
    registerRelation(source, propertyKey, "one-to-many", target, options);
  };
}

export function ManyToOne(
  target: () => EntityTarget,
  options: RelationOptions = {},
): PropertyDecorator {
  return (source, propertyKey) => {
    registerRelation(source, propertyKey, "many-to-one", target, options);
  };
}

export function ManyToMany(
  target: () => EntityTarget,
  options: RelationOptions = {},
): PropertyDecorator {
  return (source, propertyKey) => {
    registerRelation(source, propertyKey, "many-to-many", target, options);
  };
}

function normalizeColumnOptions(
  options: ColumnOptions | string,
): ColumnOptions {
  return typeof options === "string" ? { name: options } : options;
}
