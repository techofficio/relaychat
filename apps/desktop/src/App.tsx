import React from "react";
import {
  WorkspaceApp,
  createBrowserWorkspacePersistence,
  type WorkspacePersistence
} from "@relaychat/ui";
import { invoke } from "@tauri-apps/api/core";

import "./index.css";

const STORAGE_KEY = "relaychat_workspace_v2";
const LEGACY_STORAGE_KEYS = [
  "relaychat_workspace_v1",
  "discord_replacement_workspace_v1"
];

function createDesktopPersistence(initialRaw: string | null): WorkspacePersistence {
  let current = initialRaw;
  return {
    load: () => current,
    save: (raw) => {
      current = raw;
      void invoke("save_workspace_state", { raw });
    }
  };
}

export default function App() {
  const fallbackPersistence = React.useMemo(
    () => createBrowserWorkspacePersistence(STORAGE_KEY, LEGACY_STORAGE_KEYS),
    []
  );
  const [persistence, setPersistence] = React.useState<WorkspacePersistence | null>(null);

  React.useEffect(() => {
    let active = true;

    const hydrate = async () => {
      try {
        const desktopRaw = await invoke<string | null>("load_workspace_state");
        const fallbackRaw = fallbackPersistence.load();
        const seed = desktopRaw ?? fallbackRaw;
        if (active) {
          setPersistence(createDesktopPersistence(seed));
        }
        if (!desktopRaw && fallbackRaw) {
          await invoke("save_workspace_state", { raw: fallbackRaw });
        }
      } catch {
        if (active) {
          setPersistence(fallbackPersistence);
        }
      }
    };

    void hydrate();

    return () => {
      active = false;
    };
  }, [fallbackPersistence]);

  if (!persistence) {
    return <div className="relaychat-loading">Loading RelayChat workspace...</div>;
  }

  return <WorkspaceApp platform="desktop" persistence={persistence} />;
}
