import { useEffect, useState } from "react";
import type { PieceKind } from "@narrative-chess/content-schema";
import {
  addRoleCatalogEntry,
  duplicateRoleCatalogEntry,
  listRoleCatalog,
  removeRoleCatalogEntry,
  resetRoleCatalog,
  saveRoleCatalog,
  updateRoleCatalogEntry,
  type RoleCatalog
} from "../roleCatalog";
import {
  connectRoleCatalogDirectory,
  getConnectedRoleCatalogDirectoryName,
  loadRoleCatalogFromDirectory,
  saveRoleCatalogDraftToDirectory,
  supportsDirectoryWrite as supportsRoleCatalogDirectory
} from "../fileSystemAccess";

type LayoutFileNotice = {
  tone: "neutral" | "success" | "error";
  text: string;
};

type RoleCatalogField =
  | "pieceKind"
  | "name"
  | "summary"
  | "traits"
  | "verbs"
  | "notes"
  | "contentStatus"
  | "reviewStatus"
  | "reviewNotes"
  | "lastReviewedAt";

type RoleCatalogFieldValue =
  | PieceKind
  | string
  | string[]
  | null
  | "empty"
  | "procedural"
  | "authored"
  | "needs review"
  | "reviewed"
  | "approved";

export type RoleCatalogController = {
  roleCatalog: RoleCatalog;
  setRoleCatalog: React.Dispatch<React.SetStateAction<RoleCatalog>>;
  roleCatalogDirectoryName: string | null;
  setRoleCatalogDirectoryName: (value: string | null) => void;
  roleCatalogFileBusyAction: string | null;
  roleCatalogFileNotice: LayoutFileNotice | null;
  isRoleCatalogDirectorySupported: boolean;
  handleRoleCatalogChange: (roleId: string, field: RoleCatalogField, value: RoleCatalogFieldValue) => void;
  handleRoleCatalogAdd: (pieceKind?: PieceKind) => void;
  handleRoleCatalogDuplicate: (roleId: string) => void;
  handleRoleCatalogRemove: (roleId: string) => void;
  handleRoleCatalogReset: () => void;
  handleConnectRoleCatalogDirectory: () => void;
  handleSaveRoleCatalogFile: () => void;
  handleLoadRoleCatalogFile: () => void;
};

export function useRoleCatalog(): RoleCatalogController {
  const [roleCatalog, setRoleCatalog] = useState<RoleCatalog>(() => listRoleCatalog());
  const [roleCatalogDirectoryName, setRoleCatalogDirectoryName] = useState<string | null>(null);
  const [roleCatalogFileBusyAction, setRoleCatalogFileBusyAction] = useState<string | null>(null);
  const [roleCatalogFileNotice, setRoleCatalogFileNotice] = useState<LayoutFileNotice | null>(null);
  const [isRoleCatalogDirectorySupported, setIsRoleCatalogDirectorySupported] = useState(false);

  useEffect(() => {
    setIsRoleCatalogDirectorySupported(supportsRoleCatalogDirectory());

    let cancelled = false;

    void getConnectedRoleCatalogDirectoryName().then((directoryName) => {
      if (!cancelled) {
        setRoleCatalogDirectoryName(directoryName);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleRoleCatalogChange = (
    roleId: string,
    field: RoleCatalogField,
    value: RoleCatalogFieldValue
  ) => {
    setRoleCatalog((current) =>
      saveRoleCatalog(
        updateRoleCatalogEntry({
          roleCatalog: current,
          roleId,
          field,
          value
        })
      )
    );
  };

  const handleRoleCatalogAdd = (pieceKind?: PieceKind) => {
    setRoleCatalog((current) =>
      saveRoleCatalog(
        addRoleCatalogEntry({
          roleCatalog: current,
          pieceKind
        })
      )
    );
  };

  const handleRoleCatalogDuplicate = (roleId: string) => {
    setRoleCatalog((current) =>
      saveRoleCatalog(
        duplicateRoleCatalogEntry({
          roleCatalog: current,
          roleId
        })
      )
    );
  };

  const handleRoleCatalogRemove = (roleId: string) => {
    setRoleCatalog((current) =>
      saveRoleCatalog(
        removeRoleCatalogEntry({
          roleCatalog: current,
          roleId
        })
      )
    );
  };

  const handleRoleCatalogReset = () => {
    setRoleCatalog(resetRoleCatalog());
  };

  const runRoleCatalogFileAction = async (actionName: string, action: () => Promise<void>) => {
    setRoleCatalogFileBusyAction(actionName);
    setRoleCatalogFileNotice(null);

    try {
      await action();
    } catch (error) {
      setRoleCatalogFileNotice({
        tone: "error",
        text: error instanceof Error
          ? error.message
          : "Something went wrong while working with the role catalog file."
      });
    } finally {
      setRoleCatalogFileBusyAction(null);
    }
  };

  const handleConnectRoleCatalogDirectory = () => {
    void runRoleCatalogFileAction("connect-role-catalog-directory", async () => {
      const result = await connectRoleCatalogDirectory();
      setRoleCatalogDirectoryName(result.directoryName);
      setRoleCatalogFileNotice({
        tone: "success",
        text: `Connected role catalog files to ${result.directoryName}.`
      });
    });
  };

  const handleSaveRoleCatalogFile = () => {
    void runRoleCatalogFileAction("save-role-catalog-file", async () => {
      const result = await saveRoleCatalogDraftToDirectory(roleCatalog);
      setRoleCatalogDirectoryName(result.directoryName);
      setRoleCatalogFileNotice({
        tone: "success",
        text: `Saved role catalog to ${result.displayPath}.`
      });
    });
  };

  const handleLoadRoleCatalogFile = () => {
    void runRoleCatalogFileAction("load-role-catalog-file", async () => {
      const result = await loadRoleCatalogFromDirectory();
      if (!result) {
        setRoleCatalogFileNotice({
          tone: "neutral",
          text: "No role catalog file matched that name in the connected folder."
        });
        return;
      }

      setRoleCatalog(saveRoleCatalog(result.roleCatalog));
      setRoleCatalogDirectoryName(result.directoryName);
      setRoleCatalogFileNotice({
        tone: "success",
        text: `Loaded role catalog from ${result.relativePath}.`
      });
    });
  };

  return {
    roleCatalog,
    setRoleCatalog,
    roleCatalogDirectoryName,
    setRoleCatalogDirectoryName,
    roleCatalogFileBusyAction,
    roleCatalogFileNotice,
    isRoleCatalogDirectorySupported,
    handleRoleCatalogChange,
    handleRoleCatalogAdd,
    handleRoleCatalogDuplicate,
    handleRoleCatalogRemove,
    handleRoleCatalogReset,
    handleConnectRoleCatalogDirectory,
    handleSaveRoleCatalogFile,
    handleLoadRoleCatalogFile
  };
}
