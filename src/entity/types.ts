export type EntityTarget<TEntity extends object = object> = new (
  ...args: any[]
) => TEntity;

export interface EntityOptions {
  name?: string;
  schema?: string;
}

export interface ColumnOptions {
  name?: string;
  nullable?: boolean;
  type?: string;
}

export interface RelationOptions {
  mappedBy?: string;
  inversedBy?: string;
  joinColumn?: string;
  joinTable?: string;
}

export type RelationKind = "one-to-many" | "many-to-one" | "many-to-many";

export interface ColumnMetadata {
  propertyName: string;
  columnName: string;
  nullable: boolean;
  type?: string;
  primary: boolean;
}

export interface RelationMetadata {
  propertyName: string;
  kind: RelationKind;
  target: () => EntityTarget;
  mappedBy?: string;
  inversedBy?: string;
  joinColumn?: string;
  joinTable?: string;
}

export interface EntityMetadata {
  target: EntityTarget;
  tableName: string;
  schema?: string;
  columns: ColumnMetadata[];
  relations: RelationMetadata[];
  primaryColumn?: ColumnMetadata;
}
