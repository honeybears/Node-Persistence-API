import {
  PostgresqlQueryable,
  PostgresqlQueryResult,
} from "./types";

export interface PostgresqlDriverConnection {
  query<TRow = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<PostgresqlQueryResult<TRow>> | PostgresqlQueryResult<TRow>;
  end?(): Promise<void> | void;
  release?(): void;
}

export class PostgresqlConnection implements PostgresqlQueryable {
  constructor(private readonly connection: PostgresqlDriverConnection) {}

  query<TRow = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<PostgresqlQueryResult<TRow>> | PostgresqlQueryResult<TRow> {
    return this.connection.query<TRow>(text, values);
  }

  async close(): Promise<void> {
    if (this.connection.end) {
      await this.connection.end();
      return;
    }

    this.connection.release?.();
  }
}
