import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, {
  type GeoJSONSource,
  type Map as MapLibreMap
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ExternalLink, Map as MapIcon, Satellite } from "lucide-react";
import type { CityBoard, DistrictCell, MoveRecord, PieceState } from "@narrative-chess/content-schema";
import { Button } from "@/components/ui/button";
import type { AnimatedPieceFrame } from "@/chessMotion";
import { useCaptureImpact } from "@/hooks/useCaptureImpact";
import { PieceArt } from "./PieceArt";
import {
  buildOpenStreetMapUrl,
  createDistrictRadiusGeoJson,
  createDistrictMarkerGeoJson,
  createMapLibreRasterStyle,
  getActiveCityMapLocation,
  getCityBoardMarkerBounds,
  getDistanceMeters,
  getDistrictMapCenter,
  getDistrictRadiusMeters,
  type MapViewMode
} from "./cityMapShared";

type CityMapLibrePanelProps = {
  cityBoard: CityBoard;
  pieces: AnimatedPieceFrame[];
  selectedDistrict: DistrictCell | null;
  hoveredDistrict: DistrictCell | null;
  lastMoveDistrict: DistrictCell | null;
  lastMove: MoveRecord | null;
  onPieceSquareHover?: (square: PieceState["square"] | null) => void;
};

type ProjectedPieceMarker = {
  pieceId: string;
  side: PieceState["side"];
  kind: AnimatedPieceFrame["kind"];
  square: PieceState["square"];
  x: number;
  y: number;
  size: number;
  opacity: number;
  zIndex: number;
  isActive: boolean;
  isAttackingPiece: boolean;
  isKingCheck: boolean;
  isKingCheckmate: boolean;
};

const districtRadiusSourceId = "district-radius";
const districtRadiusFillLayerId = "district-radius-fill-layer";
const districtRadiusStrokeLayerId = "district-radius-stroke-layer";
const districtRadiusStrokeColor = "#4b5563";
const districtMarkerSourceId = "district-markers";
const districtMarkerLayerId = "district-markers-layer";
const districtMarkerActiveLayerId = "district-markers-active-layer";
const districtMarkerLabelLayerId = "district-markers-label-layer";

function interpolateCoordinate(
  start: [number, number],
  end: [number, number],
  progress: number
): [number, number] {
  return [
    start[0] + (end[0] - start[0]) * progress,
    start[1] + (end[1] - start[1]) * progress
  ];
}

function interpolateLinear(
  value: number,
  minValue: number,
  maxValue: number,
  minResult: number,
  maxResult: number
) {
  if (value <= minValue) {
    return minResult;
  }

  if (value >= maxValue) {
    return maxResult;
  }

  const progress = (value - minValue) / (maxValue - minValue);
  return minResult + (maxResult - minResult) * progress;
}

function createProjectedPieceMarkers(input: {
  map: MapLibreMap;
  cityBoard: CityBoard;
  pieces: AnimatedPieceFrame[];
  activeDistrict: DistrictCell | null;
  lastMove: MoveRecord | null;
}) {
  const { map, cityBoard, pieces, activeDistrict, lastMove } = input;
  const activeSquare = activeDistrict?.square ?? null;
  const activeCenter = activeDistrict ? getDistrictMapCenter(cityBoard, activeDistrict) : null;
  const activeRadiusMeters = activeDistrict ? getDistrictRadiusMeters(activeDistrict) : 0;
  const threatenedKingSide = lastMove?.isCheck || lastMove?.isCheckmate
    ? lastMove.side === "white" ? "black" : "white"
    : null;
  const markerSize = interpolateLinear(map.getZoom(), 10, 14, 34, 48);

  return pieces
    .flatMap((piece) => {
      const fromDistrict = piece.fromSquare
        ? cityBoard.districts.find((candidate) => candidate.square === piece.fromSquare) ?? null
        : null;
      const toDistrict = piece.toSquare
        ? cityBoard.districts.find((candidate) => candidate.square === piece.toSquare) ?? null
        : null;

      if (!fromDistrict && !toDistrict) {
        return [];
      }

      const fromCoordinates = fromDistrict ? getDistrictMapCenter(cityBoard, fromDistrict) : null;
      const toCoordinates = toDistrict ? getDistrictMapCenter(cityBoard, toDistrict) : null;
      const coordinates =
        fromCoordinates && toCoordinates
          ? interpolateCoordinate(fromCoordinates, toCoordinates, piece.progress)
          : (toCoordinates ?? fromCoordinates)!;
      const projected = map.project(coordinates);
      const isWithinActiveRadius =
        activeCenter !== null &&
        getDistanceMeters(activeCenter, coordinates) <= activeRadiusMeters;

      return [{
        pieceId: piece.pieceId,
        side: piece.side,
        kind: piece.kind,
        square: piece.displaySquare ?? piece.toSquare ?? piece.fromSquare,
        x: projected.x,
        y: projected.y,
        size: markerSize,
        opacity: piece.opacity,
        zIndex: piece.zIndex,
        isActive: piece.displaySquare === activeSquare || isWithinActiveRadius,
        isAttackingPiece: Boolean(lastMove?.capturedPieceId && piece.pieceId === lastMove.pieceId),
        isKingCheck: Boolean(threatenedKingSide === piece.side && piece.kind === "king" && lastMove?.isCheck),
        isKingCheckmate: Boolean(
          threatenedKingSide === piece.side && piece.kind === "king" && lastMove?.isCheckmate
        )
      } satisfies ProjectedPieceMarker];
    })
    .filter((piece): piece is ProjectedPieceMarker => piece.square !== null);
}

function ensureDistrictMarkerLayers(map: MapLibreMap, cityBoard: CityBoard, activeSquare: string | null) {
  const activeDistrict = cityBoard.districts.find((district) => district.square === activeSquare) ?? null;
  const radiusData = createDistrictRadiusGeoJson({
    cityBoard,
    districts: activeDistrict ? [activeDistrict] : []
  });
  const existingRadiusSource = map.getSource(districtRadiusSourceId) as GeoJSONSource | undefined;

  if (existingRadiusSource) {
    existingRadiusSource.setData(radiusData);
  } else {
    map.addSource(districtRadiusSourceId, {
      type: "geojson",
      data: radiusData
    });

    map.addLayer({
      id: districtRadiusFillLayerId,
      type: "fill",
      source: districtRadiusSourceId,
      paint: {
        "fill-color": "#f0abfc",
        "fill-opacity": 0.16
      }
    });

    map.addLayer({
      id: districtRadiusStrokeLayerId,
      type: "line",
      source: districtRadiusSourceId,
      paint: {
        "line-color": districtRadiusStrokeColor,
        "line-opacity": 0.72,
        "line-width": 1.5
      }
    });
  }

  const markerData = createDistrictMarkerGeoJson({
    cityBoard,
    activeSquare
  });
  const existingSource = map.getSource(districtMarkerSourceId) as GeoJSONSource | undefined;

  if (existingSource) {
    existingSource.setData(markerData);
    return;
  }

  map.addSource(districtMarkerSourceId, {
    type: "geojson",
    data: markerData
  });

  map.addLayer({
    id: districtMarkerLayerId,
    type: "circle",
    source: districtMarkerSourceId,
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        3,
        14,
        5
      ],
      "circle-color": "#111827",
      "circle-stroke-width": 1.5,
      "circle-stroke-color": "#ffffff",
      "circle-opacity": 0.85
    }
  });

  map.addLayer({
    id: districtMarkerActiveLayerId,
    type: "circle",
    source: districtMarkerSourceId,
    filter: ["==", ["get", "isActive"], 1],
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        6,
        14,
        9
      ],
      "circle-color": "#696969",
      "circle-stroke-width": 2,
      "circle-stroke-color": "#111827",
      "circle-opacity": 0.95
    }
  });

  map.addLayer({
    id: districtMarkerLabelLayerId,
    type: "symbol",
    source: districtMarkerSourceId,
    layout: {
      "text-field": ["get", "square"],
      "text-size": 10,
      "text-font": ["Arial Unicode MS Regular"],
      "text-offset": [0, 1.5],
      "text-anchor": "top",
      "text-allow-overlap": false,
      "text-ignore-placement": false
    },
    paint: {
      "text-color": "#111827",
      "text-halo-color": "rgba(255,255,255,0.95)",
      "text-halo-width": 1.25
    },
    minzoom: 11
  });
}

export function CityMapLibrePanel({
  cityBoard,
  pieces,
  selectedDistrict,
  hoveredDistrict,
  lastMoveDistrict,
  lastMove,
  onPieceSquareHover
}: CityMapLibrePanelProps) {
  const [viewMode, setViewMode] = useState<MapViewMode>("map");
  const [overlayState, setOverlayState] = useState({ revision: 0, zoom: 0 });
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const hasHydratedCamera = useRef(false);
  const onPieceSquareHoverRef = useRef(onPieceSquareHover);
  const overlayFrameRef = useRef<number | null>(null);
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
  const highlightedSquare = hoveredDistrict?.square ?? selectedDistrict?.square ?? lastMove?.to ?? null;
  const highlightedDistrict =
    hoveredDistrict ??
    selectedDistrict ??
    (lastMoveDistrict?.square === highlightedSquare ? lastMoveDistrict : null) ??
    cityBoard.districts.find((district) => district.square === highlightedSquare) ??
    null;
  const cameraSquare = selectedDistrict?.square ?? null;
  const cityBoardBounds = useMemo(() => getCityBoardMarkerBounds(cityBoard), [cityBoard]);
  const openUrl = useMemo(
    () => buildOpenStreetMapUrl(activeLocation.center, Math.round(activeLocation.zoom)),
    [activeLocation.center, activeLocation.zoom]
  );
  const focusedZoom = Math.max(activeLocation.zoom - 0.3, 9.5);
  const activeCaptureImpact = useCaptureImpact({
    pieces,
    lastMove
  });
  const projectedPieces = useMemo(() => {
    const map = mapRef.current;
    if (!map) {
      return [] as ProjectedPieceMarker[];
    }

    return createProjectedPieceMarkers({
      map,
      cityBoard,
      pieces,
      activeDistrict: highlightedDistrict,
      lastMove
    });
  }, [cityBoard, highlightedDistrict, lastMove, overlayState.revision, overlayState.zoom, pieces]);

  useEffect(() => {
    onPieceSquareHoverRef.current = onPieceSquareHover;
  }, [onPieceSquareHover]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const scheduleOverlayUpdate = () => {
      if (overlayFrameRef.current !== null) {
        return;
      }

      overlayFrameRef.current = window.requestAnimationFrame(() => {
        overlayFrameRef.current = null;
        setOverlayState((current) => ({
          revision: current.revision + 1,
          zoom: map.getZoom()
        }));
      });
    };

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: createMapLibreRasterStyle(viewMode),
      center: activeLocation.center,
      zoom: activeLocation.zoom,
      attributionControl: {}
    });

    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    map.on("load", () => {
      ensureDistrictMarkerLayers(map, cityBoard, highlightedSquare);
      scheduleOverlayUpdate();
    });
    map.on("move", scheduleOverlayUpdate);
    map.on("resize", scheduleOverlayUpdate);
    mapRef.current = map;
    hasHydratedCamera.current = false;

    return () => {
      if (overlayFrameRef.current !== null) {
        window.cancelAnimationFrame(overlayFrameRef.current);
        overlayFrameRef.current = null;
      }
      map.remove();
      mapRef.current = null;
      hasHydratedCamera.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    map.setStyle(createMapLibreRasterStyle(viewMode));
    map.once("styledata", () => {
      ensureDistrictMarkerLayers(map, cityBoard, highlightedSquare);
      map.resize();
      setOverlayState((current) => ({
        revision: current.revision + 1,
        zoom: map.getZoom()
      }));
    });
  }, [viewMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    ensureDistrictMarkerLayers(map, cityBoard, highlightedSquare);
  }, [cityBoard, highlightedSquare]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (!hasHydratedCamera.current) {
      if (cameraSquare) {
        map.jumpTo({
          center: activeLocation.center,
          zoom: focusedZoom
        });
      } else {
        map.fitBounds(cityBoardBounds, {
          padding: 40,
          duration: 0,
          maxZoom: 12.25
        });
      }
      hasHydratedCamera.current = true;
      setOverlayState((current) => ({
        revision: current.revision + 1,
        zoom: map.getZoom()
      }));
      return;
    }

    map.stop();

    if (cameraSquare) {
      map.flyTo({
        center: activeLocation.center,
        zoom: focusedZoom,
        duration: 1000,
        essential: true,
        curve: 0.5,
        speed: 1
      });
      return;
    }

    map.fitBounds(cityBoardBounds, {
      padding: 40,
      duration: 500,
      essential: true,
      maxZoom: 12.25
    });
  }, [activeLocation.center, cameraSquare, cityBoardBounds, focusedZoom]);

  useEffect(() => {
    const map = mapRef.current;
    const node = mapContainerRef.current;
    if (!map || !node || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      map.resize();
      setOverlayState((current) => ({
        revision: current.revision + 1,
        zoom: map.getZoom()
      }));
    });
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="city-map-panel city-map-panel--maplibre">
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
        <div className="city-maplibre-panel__stage">
          <div ref={mapContainerRef} className="city-maplibre-panel__canvas" />
          <div className="city-maplibre-panel__overlay" aria-hidden="true">
            {projectedPieces.map((piece) => {
              const showCaptureImpact =
                activeCaptureImpact?.moveId === lastMove?.id &&
                activeCaptureImpact?.pieceId === piece.pieceId;

              return (
                <button
                  key={piece.pieceId}
                  type="button"
                  className={[
                    "city-map-piece-marker",
                    piece.isActive ? "is-active" : "",
                    piece.isAttackingPiece ? "is-attacking" : "",
                    piece.isKingCheck ? "is-king-check" : "",
                    piece.isKingCheckmate ? "is-king-checkmate" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{
                    width: `${piece.size}px`,
                    height: `${piece.size}px`,
                    transform: `translate(${piece.x - piece.size / 2}px, ${piece.y - piece.size / 2}px)`,
                    opacity: piece.opacity,
                    zIndex: 10 + piece.zIndex
                  }}
                  tabIndex={-1}
                  aria-label={`${piece.side} ${piece.kind} on ${piece.square}`}
                  onMouseEnter={() => onPieceSquareHoverRef.current?.(piece.square)}
                  onMouseLeave={() => onPieceSquareHoverRef.current?.(null)}
                  onFocus={() => onPieceSquareHoverRef.current?.(piece.square)}
                  onBlur={() => onPieceSquareHoverRef.current?.(null)}
                >
                  {showCaptureImpact ? (
                    <span className="city-map-piece-marker__capture-cloud capture-impact-cloud">
                      <span className="city-map-piece-marker__capture-puff city-map-piece-marker__capture-puff--left" />
                      <span className="city-map-piece-marker__capture-puff city-map-piece-marker__capture-puff--center" />
                      <span className="city-map-piece-marker__capture-puff city-map-piece-marker__capture-puff--right" />
                    </span>
                  ) : null}
                  <span className="city-map-piece-marker__disc">
                    <PieceArt
                      side={piece.side}
                      kind={piece.kind}
                      className="city-map-piece-marker__art"
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="city-map-panel__toolbar">
        <div className="city-map-panel__toggle-group" role="group" aria-label="Map imagery">
          <Button
            type="button"
            size="sm"
            variant={viewMode === "map" ? "secondary" : "outline"}
            onClick={() => setViewMode("map")}
          >
            <MapIcon />
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
            Source
            <ExternalLink />
          </a>
        </Button>
      </div>
    </div>
  );
}
