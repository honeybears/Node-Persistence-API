# NPA VS Code Extension

This package is the VS Code integration shell for NPA repository method names.
It scans TypeScript entity and repository source, then delegates completion and
diagnostic decisions to `@node-persistence-api/language`.

Repository: [honeybears/Node-Persistence-API](https://github.com/honeybears/Node-Persistence-API)

## Features

- completion inside classes or interfaces extending `NPARepository<Entity, Id>`
- diagnostics for invalid `findBy`, `findOneBy`, `existsBy`, `countBy`, and
  `deleteBy` method names
- direct entity columns and relation target fields
- `@Query` named-parameter completion inside SQL strings

## Usage

Install the `npa` extension in VS Code, then open a TypeScript project using
`@node-persistence-api/core`.

```ts
abstract class UserRepository extends NPARepository<User, number> {
  abstract findByName: (name: string) => Promise<User[]>;
}
```

Start typing a derived method name inside the repository class or interface.
The extension suggests valid method names and reports invalid property/operator
segments as diagnostics.

## Develop

```bash
pnpm --dir packages/vscode test:core
pnpm --dir packages/vscode package:vsix
```
