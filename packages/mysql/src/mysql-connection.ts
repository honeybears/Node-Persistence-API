import {
  MysqlQueryable,
  MysqlRawQueryResult,
} from "./types";

export interface MysqlDriverConnection {
  query?<TRow = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<MysqlRawQueryResult<TRow>> | MysqlRawQueryResult<TRow>;
  execute?<TRow = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<MysqlRawQueryResult<TRow>> | MysqlRawQueryResult<TRow>;
  end?(): Promise<void> | void;
  release?(): void;
  getConnection?(): Promise<MysqlDriverConnection>;
}

export class MysqlConnection implements MysqlQueryable {
  constructor(private readonly connection: MysqlDriverConnection) {}

  query<TRow = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<MysqlRawQueryResult<TRow>> | MysqlRawQueryResult<TRow> {
    if (this.connection.query) {
      return this.connection.query<TRow>(text, values);
    }

    if (this.connection.execute) {
      return this.connection.execute<TRow>(text, values);
    }

    throw new Error("MySQL connection requires query() or execute().");
  }

  execute<TRow = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<MysqlRawQueryResult<TRow>> | MysqlRawQueryResult<TRow> {
    if (this.connection.execute) {
      return this.connection.execute<TRow>(text, values);
    }

    if (this.connection.query) {
      return this.connection.query<TRow>(text, values);
    }

    throw new Error("MySQL connection requires query() or execute().");
  }

  async close(): Promise<void> {
    await this.connection.end?.();
  }
}
