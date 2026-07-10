import type { MigrationEntitySchema } from "@node-persistence-api/core";
import { parseEntitySchemasFromSource } from "@node-persistence-api/core/adapter";
import {
  NPALanguageEntityPropertyKind,
  NPALanguageEntityRelationKind,
  type NPALanguageEntityProperty,
  type NPALanguageEntitySchema,
  type NPALanguageWorkspaceSchema,
} from "./types";

export interface NPALanguageEntitySource {
  filePath: string;
  text: string;
}

export function parseLanguageEntitySchemasFromSource(
  source: string,
  filePath = "",
): NPALanguageEntitySchema[] {
  return parseEntitySchemasFromSource(source, filePath).map(
    toNPALanguageEntitySchema,
  );
}

export function collectLanguageWorkspaceSchemaFromSources(
  sources: NPALanguageEntitySource[],
): NPALanguageWorkspaceSchema {
  return {
    entities: sources.flatMap((source) =>
      parseLanguageEntitySchemasFromSource(source.text, source.filePath),
    ),
  };
}

export function toNPALanguageEntitySchema(
  entity: MigrationEntitySchema,
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
      type: relation.targetClassName,
      target: relation.targetClassName,
      relationKind: toLanguageRelationKind(relation.kind),
    })),
  ];

  return {
    className: entity.className,
    properties,
  };
}

export function toNPALanguageWorkspaceSchema(
  entities: MigrationEntitySchema[],
): NPALanguageWorkspaceSchema {
  return {
    entities: entities.map(toNPALanguageEntitySchema),
  };
}

function toLanguageRelationKind(kind: string): NPALanguageEntityRelationKind {
  if (kind === NPALanguageEntityRelationKind.ONE_TO_ONE) {
    return NPALanguageEntityRelationKind.ONE_TO_ONE;
  }

  if (kind === NPALanguageEntityRelationKind.ONE_TO_MANY) {
    return NPALanguageEntityRelationKind.ONE_TO_MANY;
  }

  if (kind === NPALanguageEntityRelationKind.MANY_TO_MANY) {
    return NPALanguageEntityRelationKind.MANY_TO_MANY;
  }

  return NPALanguageEntityRelationKind.MANY_TO_ONE;
}
