import { NPAPersistenceError } from "../error";
import { ColumnMetadata } from "./types";

export function normalizeColumnValue(
  column: ColumnMetadata | undefined,
  value: unknown,
): unknown {
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
