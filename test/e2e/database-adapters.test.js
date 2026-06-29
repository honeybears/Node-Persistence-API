const test = require("node:test");

const {
  assertRepositoryContract,
  createProductEntity,
  databaseAdapters,
  runDatabaseFlow,
} = require("./database-flow");

for (const adapter of databaseAdapters) {
  test(
    `runs ${adapter.name} repository E2E against a real database`,
    { timeout: 240_000 },
    (t) =>
      runDatabaseFlow(t, adapter, async ({ queryable, tableName }) => {
        const repository = adapter.createRepository({
          entity: createProductEntity(tableName),
          queryable,
        });

        await assertRepositoryContract(repository);
      }),
  );
}
