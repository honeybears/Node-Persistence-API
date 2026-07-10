import { NPATransactionError } from "../error";
import type { TransactionManager } from "./types";

interface TransactionManagerRegistration {
  manager: TransactionManager;
  references: number;
}

const transactionManagers = new Map<TransactionManager, number>();
const namedTransactionManagers = new Map<
  string,
  TransactionManagerRegistration
>();

export function registerTransactionManager(
  manager: TransactionManager,
  name?: string,
): () => void {
  if (name) {
    const registered = namedTransactionManagers.get(name);

    if (registered && registered.manager !== manager) {
      throw new NPATransactionError(
        `Transaction manager "${name}" is already registered.`,
        {
          code: "NPA_TRANSACTION_MANAGER_DUPLICATED",
          details: { name },
        },
      );
    }

    namedTransactionManagers.set(name, {
      manager,
      references: (registered?.references ?? 0) + 1,
    });
  }

  transactionManagers.set(
    manager,
    (transactionManagers.get(manager) ?? 0) + 1,
  );

  let registered = true;

  return () => {
    if (!registered) {
      return;
    }

    registered = false;
    unregisterTransactionManager(manager, name);
  };
}

export function clearTransactionManagers(): void {
  transactionManagers.clear();
  namedTransactionManagers.clear();
}

export function resolveRegisteredTransactionManager(
  name?: string,
): TransactionManager | undefined {
  if (name) {
    const registration = namedTransactionManagers.get(name);

    if (!registration) {
      throw new NPATransactionError(
        `@Transactional could not find transaction manager "${name}".`,
        {
          code: "NPA_TRANSACTION_MANAGER_NOT_FOUND",
          details: { name },
        },
      );
    }

    return registration.manager;
  }

  if (transactionManagers.size === 0) {
    return undefined;
  }

  if (transactionManagers.size > 1) {
    throw new NPATransactionError(
      "@Transactional found multiple transaction managers. Pass @Transactional({ manager }), @Transactional({ managerProperty }), or @Transactional({ managerName }).",
      {
        code: "NPA_TRANSACTION_MANAGER_AMBIGUOUS",
        details: { count: transactionManagers.size },
      },
    );
  }

  return transactionManagers.keys().next().value;
}

function unregisterTransactionManager(
  manager: TransactionManager,
  name?: string,
): void {
  const references = transactionManagers.get(manager);

  if (references === 1) {
    transactionManagers.delete(manager);
  } else if (references !== undefined) {
    transactionManagers.set(manager, references - 1);
  }

  if (!name) {
    return;
  }

  const namedRegistration = namedTransactionManagers.get(name);

  if (!namedRegistration || namedRegistration.manager !== manager) {
    return;
  }

  if (namedRegistration.references === 1) {
    namedTransactionManagers.delete(name);
  } else {
    namedRegistration.references -= 1;
  }
}
