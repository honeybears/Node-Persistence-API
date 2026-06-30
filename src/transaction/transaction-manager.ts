import { AsyncLocalStorage } from "node:async_hooks";
import {
  NPATransactionManager,
  NPATransactionOptions,
  NPATransactionPropagation,
} from "./types";

interface TransactionContext<TResource> {
  resource: TResource;
}

export abstract class AbstractTransactionManager<TResource>
  implements NPATransactionManager
{
  private readonly storage = new AsyncLocalStorage<TransactionContext<TResource>>();

  async transactional<T>(
    work: () => Promise<T> | T,
    options: NPATransactionOptions = {},
  ): Promise<T> {
    const propagation = options.propagation ?? "required";
    this.assertSupportedPropagation(propagation);

    if (propagation === "required" && this.storage.getStore()) {
      return work();
    }

    const resource = await this.acquireTransactionResource(options);
    let began = false;
    let committed = false;

    try {
      await this.beginTransaction(resource, options);
      began = true;

      const result = await this.storage.run({ resource }, () =>
        Promise.resolve(work()),
      );

      await this.commitTransaction(resource, options);
      committed = true;

      return result;
    } catch (error) {
      if (began && !committed) {
        await Promise.resolve(
          this.rollbackTransaction(resource, options),
        ).catch(() => undefined);
      }

      throw error;
    } finally {
      await this.releaseTransactionResource(resource, options);
    }
  }

  isTransactionActive(): boolean {
    return !!this.storage.getStore();
  }

  protected getCurrentTransactionResource(): TResource | undefined {
    return this.storage.getStore()?.resource;
  }

  protected abstract acquireTransactionResource(
    options: NPATransactionOptions,
  ): Promise<TResource> | TResource;

  protected abstract beginTransaction(
    resource: TResource,
    options: NPATransactionOptions,
  ): Promise<void> | void;

  protected abstract commitTransaction(
    resource: TResource,
    options: NPATransactionOptions,
  ): Promise<void> | void;

  protected abstract rollbackTransaction(
    resource: TResource,
    options: NPATransactionOptions,
  ): Promise<void> | void;

  protected releaseTransactionResource(
    _resource: TResource,
    _options: NPATransactionOptions,
  ): Promise<void> | void {
    return undefined;
  }

  private assertSupportedPropagation(
    propagation: NPATransactionPropagation,
  ): void {
    if (propagation !== "required" && propagation !== "requires_new") {
      throw new Error(`Unsupported transaction propagation: ${propagation}`);
    }
  }
}
