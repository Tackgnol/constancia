interface DeliveryEntry<T> {
  fingerprint: string;
  promise: Promise<T>;
  completed: boolean;
}

export class DeliveryIdConflictError extends Error {
  constructor(readonly deliveryId: string) {
    super(`Delivery id "${deliveryId}" was reused with a different payload.`);
    this.name = 'DeliveryIdConflictError';
  }
}

export class DeliveryDeduplicator<T> {
  readonly #entries = new Map<string, DeliveryEntry<T>>();

  constructor(private readonly maxCompletedEntries = 1_000) {}

  async execute(
    deliveryId: string,
    fingerprint: string,
    operation: () => Promise<T>,
  ): Promise<{ value: T; replayed: boolean }> {
    const existing = this.#entries.get(deliveryId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new DeliveryIdConflictError(deliveryId);
      }

      return { value: await existing.promise, replayed: true };
    }

    const entry: DeliveryEntry<T> = {
      fingerprint,
      promise: operation(),
      completed: false,
    };
    this.#entries.set(deliveryId, entry);

    try {
      const value = await entry.promise;
      entry.completed = true;
      this.trimCompletedEntries();
      return { value, replayed: false };
    } catch (error) {
      this.#entries.delete(deliveryId);
      throw error;
    }
  }

  private trimCompletedEntries(): void {
    let completedCount = 0;
    for (const entry of this.#entries.values()) {
      if (entry.completed) completedCount += 1;
    }

    if (completedCount <= this.maxCompletedEntries) {
      return;
    }

    for (const [deliveryId, entry] of this.#entries) {
      if (!entry.completed) continue;
      this.#entries.delete(deliveryId);
      completedCount -= 1;
      if (completedCount <= this.maxCompletedEntries) return;
    }
  }
}
