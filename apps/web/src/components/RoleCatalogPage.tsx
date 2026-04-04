import type { PieceKind } from "@narrative-chess/content-schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { getPieceGlyph, getPieceKindLabel } from "../chessPresentation";
import {
  formatRoleCatalogEntry,
  pieceKinds,
  type RoleCatalog
} from "../roleCatalog";
import { Panel } from "./Panel";

type RoleCatalogPageProps = {
  roleCatalog: RoleCatalog;
  onRoleCatalogChange: (pieceKind: PieceKind, value: string) => void;
  onRoleCatalogReset: () => void;
};

export function RoleCatalogPage({
  roleCatalog,
  onRoleCatalogChange,
  onRoleCatalogReset
}: RoleCatalogPageProps) {
  return (
    <main className="role-page">
      <Card className="role-page__intro">
        <CardHeader className="role-page__intro-header">
          <div className="grid gap-2">
            <p className="hero__eyebrow">Role Catalog</p>
            <CardTitle>Customize what each chess piece can become.</CardTitle>
            <p className="role-page__lede">
              Edit the job and role pools below. Changes save locally and feed back into the
              character roster across the app.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onRoleCatalogReset}>
            Reset defaults
          </Button>
        </CardHeader>
      </Card>

      <section className="role-page__grid">
        {pieceKinds.map((pieceKind) => (
          <Panel
            key={pieceKind}
            title={getPieceKindLabel(pieceKind)}
            eyebrow="Piece Type"
          >
            <div className="role-card">
              <div className="role-card__title">
                <span className="role-card__icon" aria-hidden="true">
                  {getPieceGlyph({ side: "white", kind: pieceKind })}
                </span>
                <div>
                  <p className="role-card__name">{getPieceKindLabel(pieceKind)}</p>
                  <p className="muted">One role per line or comma-separated.</p>
                </div>
              </div>

              <label className="field-label" htmlFor={`role-catalog-${pieceKind}`}>
                Jobs and roles
              </label>
              <Textarea
                id={`role-catalog-${pieceKind}`}
                className="role-card__textarea"
                value={formatRoleCatalogEntry(roleCatalog, pieceKind)}
                onChange={(event) => onRoleCatalogChange(pieceKind, event.currentTarget.value)}
                rows={8}
              />

              <div className="chip-row">
                {roleCatalog[pieceKind].map((role) => (
                  <Badge key={`${pieceKind}-${role}`} variant="secondary" className="chip">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
          </Panel>
        ))}
      </section>
    </main>
  );
}
