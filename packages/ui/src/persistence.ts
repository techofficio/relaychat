export interface WorkspacePersistence {
  load: () => string | null;
  save: (raw: string) => void;
}

export function createBrowserWorkspacePersistence(
  storageKey: string,
  legacyKeys: string[] = []
): WorkspacePersistence {
  return {
    load: () => {
      if (typeof window === "undefined") {
        return null;
      }

      const current = window.localStorage.getItem(storageKey);
      if (current) {
        return current;
      }

      for (const legacyKey of legacyKeys) {
        const legacy = window.localStorage.getItem(legacyKey);
        if (legacy) {
          return legacy;
        }
      }

      return null;
    },
    save: (raw) => {
      if (typeof window === "undefined") {
        return;
      }
      window.localStorage.setItem(storageKey, raw);
    }
  };
}

export function createInMemoryWorkspacePersistence(initialRaw: string | null = null): WorkspacePersistence {
  let current = initialRaw;
  return {
    load: () => current,
    save: (raw) => {
      current = raw;
    }
  };
}
