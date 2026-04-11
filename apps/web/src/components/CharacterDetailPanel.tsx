import type {
  CharacterSummary,
  NarrativeEvent,
  PieceState,
  Square,
  MoveRecord
} from "@narrative-chess/content-schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getPieceDisplayName } from "../chessPresentation";
import { PieceArt } from "./PieceArt";

type CharacterDetailPanelProps = {
  focusedSquare: Square | null;
  focusedPiece: PieceState | null;
  focusedCharacter: CharacterSummary | null;
  focusedCharacterMoments: NarrativeEvent[];
  moveHistory: MoveRecord[];
  showRecentCharacterActions: boolean;
};

export function CharacterDetailPanel({
  focusedSquare,
  focusedPiece,
  focusedCharacter,
  focusedCharacterMoments,
  moveHistory,
  showRecentCharacterActions
}: CharacterDetailPanelProps) {
  const hasCharacter = Boolean(focusedCharacter && focusedPiece);
  const blankValue = "\u00A0";

  const movesByNumber = new Map(moveHistory.map((move) => [move.moveNumber, move]));

  const momentsWithSan = focusedCharacterMoments.map((event) => {
    const move = movesByNumber.get(event.moveNumber);
    return {
      event,
      move,
      san: move?.san ?? "?"
    };
  });

  const detailName = focusedCharacter?.fullName || blankValue;
  const detailSummary = focusedCharacter?.oneLineDescription || blankValue;
  const detailRole = focusedCharacter?.role || blankValue;
  const pieceText = focusedPiece ? getPieceDisplayName(focusedPiece) : blankValue;
  const traits = focusedCharacter?.traits.length ? focusedCharacter.traits : [blankValue];
  const actions = focusedCharacter?.verbs.length ? focusedCharacter.verbs : [blankValue];

  return (
    <div className="character-detail-shell">
      <div className="character-detail-shell__header">
        <div className="character-detail-container__top-row">
          <div className="character-detail-container__identity">
            <h3 className="character-detail-container__name">{detailName}</h3>
            <span className="character-detail-container__role-inline">{detailRole}</span>
          </div>
          <div className="character-detail-container__piece-meta">
            <span className="character-detail-container__piece-text">{pieceText}</span>
            <span
              className={[
                "piece-badge__icon",
                focusedPiece ? `piece-badge__icon--${focusedPiece.side}` : "",
                "character-detail-container__piece-icon",
                focusedPiece ? "" : "character-detail-container__piece-icon--placeholder"
              ]
                .filter(Boolean)
                .join(" ")}
              aria-hidden={!focusedPiece}
            >
              {focusedPiece ? (
                <PieceArt
                  side={focusedPiece.side}
                  kind={focusedPiece.kind}
                  className="board-piece-art board-piece-art--badge"
                />
              ) : (
                blankValue
              )}
            </span>
          </div>
        </div>
      </div>
      <Tabs defaultValue="details" className="character-tabs">
        <TabsList className="character-tabs-list">
          <TabsTrigger value="details">Details</TabsTrigger>
          {showRecentCharacterActions ? (
            <TabsTrigger value="recent">Recent Actions ({focusedCharacterMoments.length})</TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="details" className="character-tabs-content">
          <div className="character-detail-container">
            <p className="detail-card__description character-detail-container__summary">{detailSummary}</p>

            <div className="character-detail-container__details-grid">
              <div className="character-detail-container__detail-column">
                <div>
                  <p className="field-label">Role</p>
                  <p className="character-detail-container__detail-value">
                    {focusedCharacter?.role || blankValue}
                  </p>
                </div>
                <div>
                  <p className="field-label">Faction</p>
                  <p className="character-detail-container__detail-value">
                    {focusedCharacter?.faction || blankValue}
                  </p>
                </div>
              </div>

              <div className="character-detail-container__detail-column">
                <div>
                  <p className="field-label">Origin</p>
                  <p className="character-detail-container__detail-value">
                    {focusedCharacter?.districtOfOrigin || blankValue}
                  </p>
                </div>
                <div>
                  <p className="field-label">Square</p>
                  <p className="character-detail-container__detail-value">{focusedSquare || blankValue}</p>
                </div>
              </div>

              <div className="character-detail-container__detail-column">
                <p className="field-label">Traits</p>
                <div className="character-detail-container__stacked-chips">
                  {traits.map((trait, index) => (
                    <span
                      key={`${trait}-${index}`}
                      className={`chip chip--block${trait === blankValue ? " chip--placeholder" : ""}`}
                      aria-hidden={trait === blankValue}
                    >
                      {trait}
                    </span>
                  ))}
                </div>
              </div>

              <div className="character-detail-container__detail-column">
                <p className="field-label">Actions</p>
                <div className="character-detail-container__stacked-chips">
                  {actions.map((action, index) => (
                    <span
                      key={`${action}-${index}`}
                      className={`chip chip--block${action === blankValue ? " chip--placeholder" : ""}`}
                      aria-hidden={action === blankValue}
                    >
                      {action}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {showRecentCharacterActions ? (
          <TabsContent value="recent" className="character-tabs-content">
            <div className="character-recent-actions">
              {!hasCharacter ? (
                <p className="muted">No character selected.</p>
              ) : momentsWithSan.length > 0 ? (
                momentsWithSan.map(({ event, san }) => (
                  <article key={event.id} className="character-action-item">
                    <div className="character-action-header">
                      <span className="character-action-move">
                        <strong>{san}</strong> <span className="muted">Move {event.moveNumber}</span>
                      </span>
                      <span className="character-action-type">{event.eventType}</span>
                    </div>
                    <p className="character-action-headline">{event.headline}</p>
                    {event.detail && <p className="character-action-detail">{event.detail}</p>}
                  </article>
                ))
              ) : (
                <p className="muted">No moves this game yet.</p>
              )}
            </div>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
