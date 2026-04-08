import { useMemo, useState } from "react";
import { ExternalLink, Map, Satellite } from "lucide-react";
import type { CityBoard, DistrictCell, MoveRecord } from "@narrative-chess/content-schema";
import { Button } from "@/components/ui/button";
import {
  buildGoogleEmbedUrl,
  buildGoogleOpenUrl,
  getActiveCityMapLocation,
  type MapViewMode
} from "./cityMapShared";

type CityMapPanelProps = {
  cityBoard: CityBoard;
  selectedDistrict: DistrictCell | null;
  hoveredDistrict: DistrictCell | null;
  lastMoveDistrict: DistrictCell | null;
  lastMove: MoveRecord | null;
};

export function CityMapPanel({
  cityBoard,
  selectedDistrict,
  hoveredDistrict,
  lastMoveDistrict,
  lastMove
}: CityMapPanelProps) {
  const [viewMode, setViewMode] = useState<MapViewMode>("map");
  const activeLocation = useMemo(
    () =>
      getActiveCityMapLocation({
        cityBoard,
        selectedDistrict,
        hoveredDistrict,
        lastMoveDistrict,
        lastMove
      }),
    [cityBoard, hoveredDistrict, lastMove, lastMoveDistrict, selectedDistrict]
  );

  const embedUrl = useMemo(
    () => buildGoogleEmbedUrl(activeLocation.query, viewMode, Math.round(activeLocation.zoom)),
    [activeLocation.query, activeLocation.zoom, viewMode]
  );
  const openUrl = useMemo(() => buildGoogleOpenUrl(activeLocation.openQuery), [activeLocation.openQuery]);

  return (
    <div className="city-map-panel">
      <div className="city-map-panel__meta">
        <div className="city-map-panel__meta-row">
          <h3 className="city-map-panel__title">{activeLocation.title}</h3>
          {activeLocation.squareLabel ? (
            <span className="side-pill side-pill--compact side-pill--white">
              {activeLocation.squareLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="city-map-panel__frame">
        <iframe
          title={`${activeLocation.title} Google Maps view`}
          src={embedUrl}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      <div className="city-map-panel__toolbar">
        <div className="city-map-panel__toggle-group" role="group" aria-label="Map imagery">
          <Button
            type="button"
            size="sm"
            variant={viewMode === "map" ? "secondary" : "outline"}
            onClick={() => setViewMode("map")}
          >
            <Map />
            Map
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === "satellite" ? "secondary" : "outline"}
            onClick={() => setViewMode("satellite")}
          >
            <Satellite />
            Satellite
          </Button>
        </div>
        <Button asChild type="button" size="sm" variant="outline">
          <a href={openUrl} target="_blank" rel="noreferrer">
            Open In Google Maps
            <ExternalLink />
          </a>
        </Button>
      </div>
    </div>
  );
}
