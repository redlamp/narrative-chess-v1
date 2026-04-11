import { ExternalLink } from "lucide-react";
import type { CharacterSummary, CityBoard, DistrictCell, PieceState } from "@narrative-chess/content-schema";
import { Button } from "@/components/ui/button";
import { getPieceDisplayName } from "../chessPresentation";
import { buildOpenStreetMapUrl, getDistrictMapCenter } from "./cityMapShared";
import { PieceArt } from "./PieceArt";

type StoryCityTileSectionProps = {
  cityBoard: CityBoard;
  focusedDistrict: DistrictCell | null;
  selectedDistrict: DistrictCell | null;
  focusedPiece: PieceState | null;
  focusedCharacter: CharacterSummary | null;
  isHoverPreview: boolean;
  showLabel?: boolean;
};

export function StoryCityTileSection({
  cityBoard,
  focusedDistrict,
  selectedDistrict,
  focusedPiece,
  focusedCharacter,
  isHoverPreview,
  showLabel = true
}: StoryCityTileSectionProps) {
  const blankValue = "\u00A0";
  const showSourceLink = Boolean(
    focusedDistrict &&
      selectedDistrict &&
      focusedDistrict.id === selectedDistrict.id &&
      !isHoverPreview
  );
  const sourceUrl =
    showSourceLink && focusedDistrict
      ? buildOpenStreetMapUrl(getDistrictMapCenter(cityBoard, focusedDistrict), focusedDistrict.mapAnchor ? 14 : 12)
      : null;
  const summary = focusedDistrict
    ? [focusedDistrict.locality, focusedDistrict.dayProfile].filter(Boolean).join(" | ") || blankValue
    : blankValue;
  const descriptors = focusedDistrict?.descriptors.length ? focusedDistrict.descriptors : [blankValue];
  const landmarks = focusedDistrict?.landmarks.length ? focusedDistrict.landmarks : [blankValue];
  const occupantName = focusedCharacter?.fullName || blankValue;
  const occupantRole = focusedCharacter?.role || blankValue;
  const occupantPieceText = focusedPiece ? getPieceDisplayName(focusedPiece) : blankValue;

  return (
    <section className="story-section story-section--city story-section--stable">
      {showLabel ? <p className="field-label">District</p> : null}
      <>
          <p className="detail-card__description story-section__description">{summary}</p>
          <div className="story-city__occupant-group">
            <p className="field-label">Occupant</p>
            <div className="story-city__occupant">
              <div className="story-city__occupant-copy">
                <p className="character-detail-container__name story-city__occupant-name">
                  {occupantName}
                </p>
                <p className="story-city__occupant-role">{occupantRole}</p>
              </div>
              <div className="character-detail-container__piece-meta">
                <span className="character-detail-container__piece-text">{occupantPieceText}</span>
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
          <div className="story-city__details-grid">
            <div className="story-city__group story-city__group--description">
              <p className="field-label">Description</p>
              <div className="chip-row">
                {descriptors.map((descriptor, index) => (
                  <span
                    key={`${descriptor}-${index}`}
                    className={`chip${descriptor === blankValue ? " chip--placeholder" : ""}`}
                    aria-hidden={descriptor === blankValue}
                  >
                    {descriptor}
                  </span>
                ))}
              </div>
            </div>
            <div className="story-city__group">
              <p className="field-label">Landmarks</p>
              <div className="chip-row">
                {landmarks.map((landmark, index) => (
                  <span
                    key={`${landmark}-${index}`}
                    className={`chip chip--soft${landmark === blankValue ? " chip--placeholder" : ""}`}
                    aria-hidden={landmark === blankValue}
                  >
                    {landmark}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {sourceUrl ? (
            <div className="story-city__footer">
              <Button asChild variant="outline" size="sm">
                <a href={sourceUrl} target="_blank" rel="noreferrer">
                  Source
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
            </div>
          ) : null}
      </>
    </section>
  );
}
