import { useEffect, useState } from "react";
import {
  applyPieceStyleSheet,
  listPieceStyleSheet,
  resetPieceStyleSheet,
  savePieceStyleSheet
} from "../pieceStyles";
import {
  connectPieceStylesDirectory,
  getConnectedPieceStylesDirectoryName,
  loadPieceStylesFromDirectory,
  savePieceStylesDraftToDirectory,
  supportsWorkspaceLayoutDirectory
} from "../fileSystemAccess";

type LayoutFileNotice = {
  tone: "neutral" | "success" | "error";
  text: string;
};

export type PieceStyleSheetController = {
  pieceStyleSheet: string;
  pieceStyleDirectoryName: string | null;
  setPieceStyleDirectoryName: (value: string | null) => void;
  pieceStyleFileBusyAction: string | null;
  pieceStyleFileNotice: LayoutFileNotice | null;
  isPieceStyleDirectorySupported: boolean;
  handlePieceStyleSheetChange: (value: string) => void;
  handleConnectPieceStyleDirectory: () => void;
  handleLoadPieceStyleSheetFromDirectory: () => void;
  handleSavePieceStyleSheetToDirectory: () => void;
  handleResetPieceStyleSheet: () => void;
};

export function usePieceStyleSheet(): PieceStyleSheetController {
  const [pieceStyleSheet, setPieceStyleSheet] = useState(() => listPieceStyleSheet());
  const [pieceStyleDirectoryName, setPieceStyleDirectoryName] = useState<string | null>(null);
  const [pieceStyleFileBusyAction, setPieceStyleFileBusyAction] = useState<string | null>(null);
  const [pieceStyleFileNotice, setPieceStyleFileNotice] = useState<LayoutFileNotice | null>(null);
  const [isPieceStyleDirectorySupported, setIsPieceStyleDirectorySupported] = useState(false);

  useEffect(() => {
    applyPieceStyleSheet(pieceStyleSheet);
  }, [pieceStyleSheet]);

  useEffect(() => {
    setIsPieceStyleDirectorySupported(supportsWorkspaceLayoutDirectory());

    let cancelled = false;

    void getConnectedPieceStylesDirectoryName().then((directoryName) => {
      if (!cancelled) {
        setPieceStyleDirectoryName(directoryName);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const runPieceStyleFileAction = async (actionName: string, action: () => Promise<void>) => {
    setPieceStyleFileBusyAction(actionName);
    setPieceStyleFileNotice(null);

    try {
      await action();
    } catch (error) {
      setPieceStyleFileNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Something went wrong while working with the piece style file."
      });
    } finally {
      setPieceStyleFileBusyAction(null);
    }
  };

  const handleConnectPieceStyleDirectory = () => {
    void runPieceStyleFileAction("connect-piece-style-directory", async () => {
      const result = await connectPieceStylesDirectory();
      setPieceStyleDirectoryName(result.directoryName);
      setPieceStyleFileNotice({
        tone: "success",
        text: `Connected piece styles to ${result.directoryName}.`
      });
    });
  };

  const handleSavePieceStyleSheetToDirectory = () => {
    void runPieceStyleFileAction("save-piece-style-file", async () => {
      const result = await savePieceStylesDraftToDirectory(pieceStyleSheet);
      setPieceStyleDirectoryName(result.directoryName);
      setPieceStyleFileNotice({
        tone: "success",
        text: `Saved piece styles to ${result.relativePath}.`
      });
    });
  };

  const handleLoadPieceStyleSheetFromDirectory = () => {
    void runPieceStyleFileAction("load-piece-style-file", async () => {
      const result = await loadPieceStylesFromDirectory();
      if (!result) {
        setPieceStyleFileNotice({
          tone: "neutral",
          text: "No saved piece-styles.local.css file was found in the connected folder."
        });
        return;
      }

      const nextSheet = savePieceStyleSheet(result.cssText);
      setPieceStyleSheet(nextSheet);
      setPieceStyleDirectoryName(result.directoryName);
      setPieceStyleFileNotice({
        tone: "success",
        text: `Loaded ${result.relativePath} into the live app stylesheet.`
      });
    });
  };

  const handleResetPieceStyleSheet = () => {
    const nextSheet = resetPieceStyleSheet();
    setPieceStyleSheet(nextSheet);
    setPieceStyleFileNotice({
      tone: "neutral",
      text: "Reset the piece stylesheet back to the bundled defaults."
    });
  };

  const handlePieceStyleSheetChange = (value: string) => {
    setPieceStyleSheet(savePieceStyleSheet(value));
  };

  return {
    pieceStyleSheet,
    pieceStyleDirectoryName,
    setPieceStyleDirectoryName,
    pieceStyleFileBusyAction,
    pieceStyleFileNotice,
    isPieceStyleDirectorySupported,
    handlePieceStyleSheetChange,
    handleConnectPieceStyleDirectory,
    handleLoadPieceStyleSheetFromDirectory,
    handleSavePieceStyleSheetToDirectory,
    handleResetPieceStyleSheet
  };
}
