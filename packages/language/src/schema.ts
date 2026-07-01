import type { NPAMigrationEntitySchema } from "@honeybeaers/npa";
import {
  NPALanguageEntityPropertyKind,
  type NPALanguageEntityProperty,
  type NPALanguageEntitySchema,
  type NPALanguageWorkspaceSchema,
} from "./types";

export function toNPALanguageEntitySchema(
  entity: NPAMigrationEntitySchema,
): NPALanguageEntitySchema {
  const properties: NPALanguageEntityProperty[] = [
    ...entity.columns.map((column) => ({
      name: column.propertyName,
      kind: column.primary
        ? NPALanguageEntityPropertyKind.ID
        : NPALanguageEntityPropertyKind.COLUMN,
      type: column.tsType,
      nullable: column.nullable,
    })),
    ...entity.relations.map((relation) => ({
      name: relation.propertyName,
      kind: NPALanguageEntityPropertyKind.RELATION,
      target: relation.targetClassName,
    })),
  ];

  return {
    className: entity.className,
    properties,
  };
}

export function toNPALanguageWorkspaceSchema(
  entities: NPAMigrationEntitySchema[],
): NPALanguageWorkspaceSchema {
  return {
    entities: entities.map(toNPALanguageEntitySchema),
  };
}
