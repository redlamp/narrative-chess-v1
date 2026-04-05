import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getPieceGlyph, getPieceKindLabel, pieceKindLabels } from "../chessPresentation";

const pieceKinds = Object.keys(pieceKindLabels) as Array<keyof typeof pieceKindLabels>;

export function PieceAssetsPage() {
  return (
    <section className="grid w-full gap-6">
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Art Assets</Badge>
            <Badge variant="outline">Piece glyph reference</Badge>
          </div>
          <CardTitle className="text-3xl tracking-tight">Chess piece art and markup</CardTitle>
          <CardDescription className="max-w-3xl text-sm leading-6">
            These are the live piece assets used by the app right now. The cards below show the
            rendered glyphs, the state classes that drive styling, and the main HTML hooks the app
            exposes for future refinements.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pieceKinds.map((kind) => (
          <Card key={kind}>
            <CardHeader className="gap-2">
              <CardTitle>{getPieceKindLabel(kind)}</CardTitle>
              <CardDescription>White and black glyphs share the same semantic hooks.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-muted/20 p-4 text-center">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">White</p>
                  <div className="piece-badge__icon mt-3 text-5xl">
                    {getPieceGlyph({ side: "white", kind })}
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/20 p-4 text-center">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Black</p>
                  <div className="piece-badge__icon mt-3 text-5xl">
                    {getPieceGlyph({ side: "black", kind })}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid gap-2 text-sm">
                <p className="font-medium">HTML hooks</p>
                <code className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
                  .board-square__piece.is-white, .board-square__piece.is-black,
                  .piece-badge__icon--white, .piece-badge__icon--black
                </code>
                <p className="text-muted-foreground">
                  The board square glyph and the inspector badge both share the same piece state
                  classes so one CSS sheet can style the whole app.
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="gap-2">
          <CardTitle>Styling anchors</CardTitle>
          <CardDescription>
            These selectors are the stable hooks for board pieces, hover badges, and future visual
            polish.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="grid gap-2">
            <p className="font-medium">Piece surfaces</p>
            <code className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
              .board-square__piece, .piece-badge__icon
            </code>
          </div>
          <div className="grid gap-2">
            <p className="font-medium">Color states</p>
            <code className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
              .is-white, .is-black, .piece-badge__icon--white, .piece-badge__icon--black
            </code>
          </div>
          <div className="grid gap-2">
            <p className="font-medium">Notable interactions</p>
            <code className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
              .board-square--selected, .board-square--inspected, .board-square:focus-visible,
              .board-square:hover
            </code>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
