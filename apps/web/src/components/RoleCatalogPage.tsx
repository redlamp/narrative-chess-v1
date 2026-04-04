import type { PieceKind } from "@narrative-chess/content-schema";
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
      <section className="role-page__intro">
        <div>
          <p className="hero__eyebrow">Role Catalog</p>
          <h2>Customize what each chess piece can become.</h2>
          <p className="role-page__lede">
            Edit the job and role pools below. Changes save locally and feed back into the character roster across the app.
          </p>
        </div>
        <button
          type="button"
          className="button button--ghost"
          onClick={onRoleCatalogReset}
        >
          Reset defaults
        </button>
      </section>

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
              <textarea
                id={`role-catalog-${pieceKind}`}
                className="field-textarea role-card__textarea"
                value={formatRoleCatalogEntry(roleCatalog, pieceKind)}
                onChange={(event) => onRoleCatalogChange(pieceKind, event.currentTarget.value)}
                rows={8}
              />

              <div className="chip-row">
                {roleCatalog[pieceKind].map((role) => (
                  <span key={`${pieceKind}-${role}`} className="chip">
                    {role}
                  </span>
                ))}
              </div>
            </div>
          </Panel>
        ))}
      </section>
    </main>
  );
}
