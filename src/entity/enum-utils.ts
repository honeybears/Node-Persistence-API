import { NPAPersistenceError } from "../error";
import { ColumnMetadata } from "./types";

export interface NormalizeColumnValueOptions {
  serializeArray?: boolean;
}

export function normalizeColumnValue(
  column: ColumnMetadata | undefined,
  value: unknown,
  options: NormalizeColumnValueOptions = {},
): unknown {
  if (column?.array && value !== null && value !== undefined) {
    if (!Array.isArray(value)) {
      throw new NPAPersistenceError(
        `Array column "${column.propertyName}" requires an array value.`,
        {
          code: "NPA_ARRAY_COLUMN_VALUE_REQUIRED",
          details: {
            property: column.propertyName,
            value,
          },
        },
      );
    }

    return options.serializeArray ? JSON.stringify(value) : value;
  }

  if (
    column?.enumType !== "ORDINAL" ||
    value === null ||
    value === undefined ||
    typeof value === "number"
  ) {
    return value;
  }

  const ordinal = column.enumValues?.indexOf(String(value)) ?? -1;

  if (ordinal < 0) {
    throw new NPAPersistenceError(
      `Invalid enum value "${String(value)}" for ${column.propertyName}.`,
      {
        code: "NPA_INVALID_ENUM_VALUE",
        details: {
          property: column.propertyName,
          value,
          enumValues: column.enumValues ?? [],
        },
      },
    );
  }

  return ordinal;
}
