export type NPARelationLoad<TEntity extends object = object> =
  | true
  | ReadonlyArray<Extract<keyof TEntity, string> | string>
  | NPARelationLoadTree<TEntity>;

export type NPARelationLoadTree<TEntity extends object = object> = {
  [K in Extract<keyof TEntity, string>]?:
    | true
    | NPARelationLoadTree<NPAUnwrappedRelation<TEntity[K]>>;
};

export type Loaded<
  TEntity extends object,
  TRelations extends NPARelationLoad<TEntity> = true,
> =
  TRelations extends true
    ? NPALoadedAllRelations<TEntity>
    : TRelations extends ReadonlyArray<infer TRelation>
      ? NPALoadedRelationList<TEntity, Extract<TRelation, keyof TEntity>>
      : TRelations extends NPARelationLoadTree<TEntity>
        ? NPALoadedRelationTree<TEntity, TRelations>
        : TEntity;

type NPALoadedAllRelations<TEntity extends object> =
  NPAReplaceRelations<TEntity, {
    [K in keyof TEntity]: NPALoadedRelationValue<TEntity[K], true>;
  }>;

type NPALoadedRelationList<
  TEntity extends object,
  TRelation extends keyof TEntity,
> =
  NPAReplaceRelations<TEntity, {
    [K in TRelation]: NPALoadedRelationValue<TEntity[K], true>;
  }>;

type NPALoadedRelationTree<
  TEntity extends object,
  TRelations extends NPARelationLoadTree<TEntity>,
> =
  NPAReplaceRelations<TEntity, {
    [K in Extract<keyof TRelations, keyof TEntity>]: NPALoadedRelationValue<
      TEntity[K],
      NonNullable<TRelations[K]>
    >;
  }>;

type NPAUnwrappedRelation<TValue> =
  TValue extends Promise<infer TResolved>
    ? NPAUnwrappedRelation<TResolved>
    : TValue extends readonly (infer TItem)[]
      ? Extract<TItem, object>
      : Extract<TValue, object>;

type NPAReplaceRelations<TEntity extends object, TRelations extends object> =
  Omit<TEntity, keyof TRelations> & TRelations;

type NPALoadedRelationValue<TValue, TSelection> =
  TValue extends Promise<infer TResolved>
    ? NPALoadedRelationValue<TResolved, TSelection>
    : TValue extends (infer TItem)[]
      ? NPALoadedRelationArray<TItem, TSelection>
      : TValue extends readonly (infer TItem)[]
        ? ReadonlyArray<NPALoadedRelationItem<TItem, TSelection>>
        : TValue extends object
          ? NPALoadedRelationObject<TValue, TSelection>
          : TValue;

type NPALoadedRelationArray<TItem, TSelection> =
  Extract<TItem, object> extends never
    ? TItem[]
    : Array<NPALoadedRelationItem<TItem, TSelection>>;

type NPALoadedRelationItem<TItem, TSelection> =
  Extract<TItem, object> extends never
    ? TItem
    : NPALoadedRelationObject<Extract<TItem, object>, TSelection>;

type NPALoadedRelationObject<TValue extends object, TSelection> =
  TSelection extends true
    ? TValue
    : TSelection extends NPARelationLoadTree<TValue>
      ? Loaded<TValue, TSelection>
      : TValue;
