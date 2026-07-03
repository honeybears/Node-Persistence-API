# @node-persistence-api/language

Editor-independent completions and diagnostics for [Node Persistence API](https://github.com/honeybears/Node-Persistence-API)
repository method names.

## Install

```bash
npm install @node-persistence-api/language
```

## Usage

```ts
import {
  getNPAQueryMethodCompletions,
  toNPALanguageWorkspaceSchema,
  validateNPAQueryMethod,
} from '@node-persistence-api/language';

const workspace = toNPALanguageWorkspaceSchema([
  {
    className: 'User',
    tableName: 'users',
    columns: [
      {
        propertyName: 'id',
        columnName: 'id',
        tsType: 'number',
        primary: true,
        nullable: false,
        version: false,
      },
      {
        propertyName: 'name',
        columnName: 'name',
        tsType: 'string',
        primary: false,
        nullable: false,
        version: false,
      },
    ],
    indexes: [],
    relations: [],
  },
]);

const user = workspace.entities[0];

const completions = getNPAQueryMethodCompletions({
  prefix: 'findByNa',
  entity: user,
  workspace,
  includeOrderBy: true,
  includePageable: true,
});

const result = validateNPAQueryMethod({
  methodName: 'findByName',
  entity: user,
  workspace,
});
```

The package does not execute user code or connect to a database. Editor
integrations should collect entity metadata, call these helpers, and render the
returned completions or diagnostics.
