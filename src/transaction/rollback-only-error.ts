export class RollbackOnlyError extends Error {
  constructor() {
    super("Transaction was marked rollback-only and cannot be committed.");
    this.name = "RollbackOnlyError";
  }
}
