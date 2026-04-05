import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { getPieceGlyph } from "../chessPresentation";
import { defaultPieceStyleSheet } from "../pieceStyles";

type FileNotice = {
  tone: "neutral" | "success" | "error";
  text: string;
};

type PieceStyleReferencePageProps = {
  pieceStyleSheet: string;
  pieceStyleDirectoryName: string | null;
  isPieceStyleDirectorySupported: boolean;
  pieceStyleFileBusyAction: string | null;
  pieceStyleFileNotice: FileNotice | null;
  onPieceStyleSheetChange: (value: string) => void;
  onConnectPieceStyleDirectory: () => void;
  onLoadPieceStyleSheetFromDirectory: () => void;
  onSavePieceStyleSheetToDirectory: () => void;
  onResetPieceStyleSheet: () => void;
};

const styleOptions = [
  {
    label: "Base outline",
    selector: ".board-square__piece.is-white, .piece-badge__icon--white",
    note: "Keeps light pieces readable on light tiles."
  },
  {
    label: "Dark outline",
    selector: ".board-square__piece.is-black, .piece-badge__icon--black",
    note: "Keeps dark pieces readable on dark tiles."
  },
  {
    label: "Hover lift",
    selector: ".board-square:hover .board-square__piece",
    note: "Adds motion without changing layout."
  },
  {
    label: "Selected state",
    selector: ".board-square--selected .board-square__piece",
    note: "Makes the active piece easier to read in play mode."
  },
  {
    label: "Inspected state",
    selector: ".board-square--inspected .board-square__piece",
    note: "Keeps the current hover target visually pinned."
  },
  {
    label: "Legal target",
    selector: ".board-square--target .board-square__piece",
    note: "Can reinforce available moves without overpowering the board."
  },
  {
    label: "Check and mate",
    selector: ".board-panel__footer, .status-card__value",
    note: "Useful if a future piece skin wants to react to board pressure states."
  },
  {
    label: "Inspector badge",
    selector: ".piece-badge__icon",
    note: "Keeps the piece icon consistent between the board and hover cards."
  }
] as const;

export function PieceStyleReferencePage({
  pieceStyleSheet,
  pieceStyleDirectoryName,
  isPieceStyleDirectorySupported,
  pieceStyleFileBusyAction,
  pieceStyleFileNotice,
  onPieceStyleSheetChange,
  onConnectPieceStyleDirectory,
  onLoadPieceStyleSheetFromDirectory,
  onSavePieceStyleSheetToDirectory,
  onResetPieceStyleSheet
}: PieceStyleReferencePageProps) {
  return (
    <section className="grid w-full gap-6">
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Style Reference</Badge>
            <Badge variant="outline">Live CSS sheet</Badge>
          </div>
          <CardTitle className="text-3xl tracking-tight">Piece styling you can edit</CardTitle>
          <CardDescription className="max-w-3xl text-sm leading-6">
            Edit the CSS directly, share it with the app live, and save the same stylesheet back to
            a local project folder. This keeps piece styling inspectable instead of buried in a
            hidden config layer.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.9fr)]">
        <div className="grid gap-6">
          <Card>
            <CardHeader className="gap-2">
              <CardTitle>Configurable states</CardTitle>
              <CardDescription>
                These are the main piece and inspection states that should stay stable across
                future polish passes.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {styleOptions.map((option) => (
                <div key={option.selector} className="rounded-lg border bg-muted/20 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{option.label}</p>
                    <Badge variant="outline">{option.selector}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{option.note}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-2">
              <CardTitle>Live CSS</CardTitle>
              <CardDescription>
                Changes here apply immediately to the board and inspector once you edit the sheet.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Textarea
                className="min-h-[26rem] font-mono text-xs leading-6"
                value={pieceStyleSheet}
                onChange={(event) => onPieceStyleSheetChange(event.currentTarget.value)}
                spellCheck={false}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onConnectPieceStyleDirectory}
                  disabled={!isPieceStyleDirectorySupported || pieceStyleFileBusyAction !== null}
                >
                  Connect folder
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onLoadPieceStyleSheetFromDirectory}
                  disabled={!pieceStyleDirectoryName || pieceStyleFileBusyAction !== null}
                >
                  Load project CSS
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onSavePieceStyleSheetToDirectory}
                  disabled={!pieceStyleDirectoryName || pieceStyleFileBusyAction !== null}
                >
                  Save project CSS
                </Button>
                <Button type="button" variant="outline" onClick={onResetPieceStyleSheet}>
                  Reset defaults
                </Button>
              </div>
              {pieceStyleFileNotice ? (
                <div
                  className="rounded-lg border bg-muted/20 p-3 text-sm"
                  data-tone={pieceStyleFileNotice.tone}
                >
                  {pieceStyleFileNotice.text}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader className="gap-2">
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                A compact view of the current glyph styling, including the same hooks used in the
                board and hover inspector.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-muted/20 p-5 text-center">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">White queen</p>
                  <div className="piece-badge__icon mt-4 text-6xl">
                    {getPieceGlyph({ side: "white", kind: "queen" })}
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/20 p-5 text-center">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Black knight</p>
                  <div className="piece-badge__icon mt-4 text-6xl">
                    {getPieceGlyph({ side: "black", kind: "knight" })}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid gap-3 text-sm">
                <div className="rounded-lg border bg-background p-4">
                  <p className="font-medium">Shared stylesheet file</p>
                  <p className="mt-1 text-muted-foreground">content/styles/piece-styles.local.css</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="font-medium">Default source</p>
                  <p className="mt-1 text-muted-foreground">Uses the bundled baseline in pieceStyles.ts.</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="font-medium">Current editor state</p>
                  <p className="mt-1 text-muted-foreground">
                    {pieceStyleSheet.trim() === defaultPieceStyleSheet.trim()
                      ? "Default stylesheet"
                      : "Custom stylesheet"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
