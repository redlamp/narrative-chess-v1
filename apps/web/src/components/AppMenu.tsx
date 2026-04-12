import { useEffect, useId, useRef, useState } from "react";
import { Download, Menu, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FloatingActionNotice, type FloatingActionNoticeState } from "./FloatingActionNotice";
import { highlightColorOptions, type HighlightColor } from "../appSettings";

type AppMenuProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveEverything: () => void;
  onLoadEverything: () => void;
  isSavingEverything: boolean;
  isLoadingEverything: boolean;
  saveEverythingNotice: FloatingActionNoticeState | null;
  onDismissSaveEverythingNotice: () => void;
  highlightColor: HighlightColor;
  onHighlightColorChange: (color: HighlightColor) => void;
};

export function AppMenu({
  isOpen,
  onOpenChange,
  onSaveEverything,
  onLoadEverything,
  isSavingEverything,
  isLoadingEverything,
  saveEverythingNotice,
  onDismissSaveEverythingNotice,
  highlightColor,
  onHighlightColorChange
}: AppMenuProps) {
  const panelId = useId();
  const titleId = useId();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isPanelHovered, setIsPanelHovered] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (menuRef.current?.contains(target)) {
        return;
      }

      onOpenChange(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onOpenChange]);

  return (
    <div className="app-menu" ref={menuRef}>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon-sm"
              aria-expanded={isOpen}
              aria-controls={panelId}
              aria-haspopup="dialog"
              aria-label="Open menu"
              onClick={() => onOpenChange(!isOpen)}
            >
              <Menu />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open menu</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {isOpen ? (
        <Card
          id={panelId}
          className="app-menu__content"
          size="sm"
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          onMouseEnter={() => setIsPanelHovered(true)}
          onMouseLeave={() => setIsPanelHovered(false)}
        >
          <CardHeader className="app-menu__section-header">
            <div className="app-menu__header-row">
              <CardTitle id={titleId}>Workspace</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="app-menu__close-button"
                aria-label="Close workspace panel"
                onClick={() => onOpenChange(false)}
              >
                <X />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="app-menu__section">
            <div className="app-menu__panel-section">
              <h3 className="app-menu__panel-title">Data</h3>
            </div>

            <div className="app-menu__actions">
              <Button
                variant="secondary"
                size="sm"
                onClick={onSaveEverything}
                disabled={isSavingEverything || isLoadingEverything}
              >
                <Save data-icon="inline-start" />
                {isSavingEverything ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onLoadEverything}
                disabled={isSavingEverything || isLoadingEverything}
              >
                <Download data-icon="inline-start" />
                {isLoadingEverything ? "Loading..." : "Load"}
              </Button>
            </div>

            <div className="app-menu__panel-section">
              <h3 className="app-menu__panel-title">Highlight color</h3>
            </div>

            <div className="app-menu__color-swatches" role="group" aria-label="Highlight color">
              {highlightColorOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={[
                    "app-menu__color-swatch",
                    highlightColor === option.id ? "app-menu__color-swatch--active" : ""
                  ].filter(Boolean).join(" ")}
                  style={{ backgroundColor: option.hex }}
                  onClick={() => onHighlightColorChange(option.id)}
                  aria-label={option.label}
                  aria-pressed={highlightColor === option.id}
                />
              ))}
            </div>

            <div className="app-menu__panel-section">
              <h3 className="app-menu__panel-title">Account Details</h3>
            </div>

            <div className="app-menu__panel-section">
              <h3 className="app-menu__panel-title">Network Details</h3>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <FloatingActionNotice
        notice={saveEverythingNotice}
        className="app-menu__floating-notice"
        isPaused={isPanelHovered}
        onDismiss={onDismissSaveEverythingNotice}
      />
    </div>
  );
}
