import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Crosshair, ExternalLink, Map as MapIcon, MapPinOff, Satellite } from "lucide-react";
import { createSnapshotFromFen, getBoardSquares } from "@narrative-chess/game-core";
import type { CityBoard, DistrictCell, Square } from "@narrative-chess/content-schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Board } from "./Board";
import {
  buildOpenStreetMapUrl,
  createDistrictMarkerGeoJson,
  createMapLibreRasterStyle,
  getCityBoardMarkerBounds,
  getDistrictMapCenter,
  type MapViewMode
} from "./cityMapShared";

type CityDistrictBoardEditorProps = {
  cityBoard: CityBoard;
  selectedDistrict: DistrictCell | null;
  highlightedDistrict: DistrictCell | null;
  hoveredSquare: Square | null;
  onHoveredSquareChange: (square: Square | null) => void;
  onSquareChange: (square: Square) => void;
  onSelectDistrict: (districtId: string) => void;
};

type CityDistrictMapEditorProps = {
  cityBoard: CityBoard;
  selectedDistrict: DistrictCell | null;
  highlightedDistrict: DistrictCell | null;
  onMapAnchorChange: (anchor: DistrictCell["mapAnchor"]) => void;
  onHighlightedDistrictChange: (districtId: string | null) => void;
  onSelectDistrict: (districtId: string) => void;
  importModeArmed: boolean;
  onImportModeConsumed: () => void;
};

const previewBoardFen = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";
const markerSourceId = "city-review-district-markers";
const markerLayerId = "city-review-district-markers-layer";
const markerActiveLayerId = "city-review-district-markers-active-layer";
const markerLabelLayerId = "city-review-district-markers-label-layer";

function syncDistrictMarkerLayers(map: MapLibreMap, cityBoard: CityBoard, activeSquare: string | null) {
  const markerData = createDistrictMarkerGeoJson({
    cityBoard,
    activeSquare
  });
  const existingSource = map.getSource(markerSourceId) as GeoJSONSource | undefined;

  if (existingSource) {
    existingSource.setData(markerData);
    return;
  }

  map.addSource(markerSourceId, {
    type: "geojson",
    data: markerData
  });

  map.addLayer({
    id: markerLayerId,
    type: "circle",
    source: markerSourceId,
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        9,
        3,
        14,
        5
      ],
      "circle-color": "#111827",
      "circle-stroke-width": 1.5,
      "circle-stroke-color": "#ffffff",
      "circle-opacity": 0.9
    }
  });

  map.addLayer({
    id: markerActiveLayerId,
    type: "circle",
    source: markerSourceId,
    filter: ["==", ["get", "isActive"], 1],
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        9,
        6,
        14,
        9
      ],
      "circle-color": "#ffffff",
      "circle-stroke-width": 2,
      "circle-stroke-color": "#111827",
      "circle-opacity": 0.95
    }
  });

  map.addLayer({
    id: markerLabelLayerId,
    type: "symbol",
    source: markerSourceId,
    layout: {
      "text-field": ["get", "square"],
      "text-size": 10,
      "text-font": ["Arial Unicode MS Regular"],
      "text-offset": [0, 1.4],
      "text-anchor": "top",
      "text-allow-overlap": false
    },
    paint: {
      "text-color": "#111827",
      "text-halo-color": "rgba(255,255,255,0.95)",
      "text-halo-width": 1.25
    },
    minzoom: 10.5
  });
}

export function CityDistrictBoardEditor({
  cityBoard,
  selectedDistrict,
  highlightedDistrict,
  hoveredSquare,
  onHoveredSquareChange,
  onSquareChange,
  onSelectDistrict
}: CityDistrictBoardEditorProps) {
  const previewSnapshot = useMemo(() => createSnapshotFromFen(previewBoardFen), []);
  const previewCells = useMemo(() => getBoardSquares(previewSnapshot), [previewSnapshot]);
  const districtsBySquare = useMemo(
    () => new Map(cityBoard.districts.map((district) => [district.square, district] as const)),
    [cityBoard.districts]
  );
  const activeDistrict = highlightedDistrict ?? selectedDistrict;

  return (
    <div className="city-placement-editor__board">
      <div className="city-placement-editor__hint-row">
        <div className="city-placement-editor__hint">
          {selectedDistrict
            ? "Use the board to reassign the selected district on the 8x8 city board."
            : "Use the board to find the matching district entry."}
        </div>
        <div className="city-placement-editor__coordinates">
          {activeDistrict ? <Badge variant="secondary">{activeDistrict.square}</Badge> : null}
          {hoveredSquare ? <Badge variant="outline">Hover {hoveredSquare}</Badge> : null}
        </div>
      </div>

      <Board
        snapshot={previewSnapshot}
        cells={previewCells}
        selectedSquare={selectedDistrict?.square ?? null}
        hoveredSquare={hoveredSquare}
        inspectedSquare={activeDistrict?.square ?? null}
        legalMoves={[]}
        viewMode="board"
        districtsBySquare={districtsBySquare}
        showCoordinates
        showDistrictLabels={false}
        showPieces={false}
        onSquareClick={(square) => {
          if (selectedDistrict) {
            onSquareChange(square);
            return;
          }

          const district = districtsBySquare.get(square);
          if (district) {
            onSelectDistrict(district.id);
          }
        }}
        onSquareHover={(square) => onHoveredSquareChange(square)}
        onSquareLeave={() => onHoveredSquareChange(null)}
      />
    </div>
  );
}

export function CityDistrictMapEditor({
  cityBoard,
  selectedDistrict,
  highlightedDistrict,
  onMapAnchorChange,
  onHighlightedDistrictChange,
  onSelectDistrict,
  importModeArmed,
  onImportModeConsumed
}: CityDistrictMapEditorProps) {
  const [viewMode, setViewMode] = useState<MapViewMode>("map");
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const hasHydratedCamera = useRef(false);
  const markerBounds = useMemo(() => getCityBoardMarkerBounds(cityBoard), [cityBoard]);
  const districtsBySquare = useMemo(
    () => new Map(cityBoard.districts.map((district) => [district.square, district] as const)),
    [cityBoard.districts]
  );
  const selectedDistrictRef = useRef<DistrictCell | null>(selectedDistrict);
  const districtsBySquareRef = useRef(districtsBySquare);
  const onMapAnchorChangeRef = useRef(onMapAnchorChange);
  const onHighlightedDistrictChangeRef = useRef(onHighlightedDistrictChange);
  const onSelectDistrictRef = useRef(onSelectDistrict);
  const importModeArmedRef = useRef(importModeArmed);
  const onImportModeConsumedRef = useRef(onImportModeConsumed);
  const activeDistrict = highlightedDistrict ?? selectedDistrict ?? null;
  const selectedCenter = useMemo(
    () => getDistrictMapCenter(cityBoard, activeDistrict ?? cityBoard.districts[0]!),
    [activeDistrict, cityBoard]
  );
  const activeSquare = activeDistrict?.square ?? null;
  const openUrl = useMemo(
    () => buildOpenStreetMapUrl(selectedCenter, activeDistrict?.mapAnchor ? 14 : 12),
    [activeDistrict?.mapAnchor, selectedCenter]
  );

  useEffect(() => {
    selectedDistrictRef.current = selectedDistrict;
    districtsBySquareRef.current = districtsBySquare;
    onMapAnchorChangeRef.current = onMapAnchorChange;
    onHighlightedDistrictChangeRef.current = onHighlightedDistrictChange;
    onSelectDistrictRef.current = onSelectDistrict;
    importModeArmedRef.current = importModeArmed;
    onImportModeConsumedRef.current = onImportModeConsumed;
  }, [
    districtsBySquare,
    importModeArmed,
    onHighlightedDistrictChange,
    onImportModeConsumed,
    onMapAnchorChange,
    onSelectDistrict,
    selectedDistrict
  ]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: createMapLibreRasterStyle(viewMode),
      center: selectedCenter,
      zoom: selectedDistrict?.mapAnchor ? 13.75 : 11.5,
      attributionControl: {}
    });

    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    map.getCanvas().style.cursor = "crosshair";
    map.on("load", () => {
      syncDistrictMarkerLayers(map, cityBoard, activeSquare);
    });
    map.on("click", (event) => {
      const markerFeature = map
        .queryRenderedFeatures(event.point, {
          layers: [markerLayerId, markerActiveLayerId]
        })
        .find((feature) => typeof feature.properties?.square === "string");

      const markerSquare =
        typeof markerFeature?.properties?.square === "string"
          ? (markerFeature.properties.square as Square)
          : null;

      if (markerSquare) {
        const district = districtsBySquareRef.current.get(markerSquare);
        if (district) {
          onSelectDistrictRef.current(district.id);
          return;
        }
      }

      if (!selectedDistrictRef.current || !importModeArmedRef.current) {
        return;
      }

      onMapAnchorChangeRef.current({
        longitude: Number(event.lngLat.lng.toFixed(6)),
        latitude: Number(event.lngLat.lat.toFixed(6))
      });
      onImportModeConsumedRef.current();
    });
    map.on("mousemove", markerLayerId, (event) => {
      map.getCanvas().style.cursor = "pointer";
      const markerSquare =
        typeof event.features?.[0]?.properties?.square === "string"
          ? (event.features[0].properties.square as string)
          : null;
      const district = markerSquare ? districtsBySquareRef.current.get(markerSquare as Square) ?? null : null;
      onHighlightedDistrictChangeRef.current(district?.id ?? null);
    });
    map.on("mousemove", markerActiveLayerId, (event) => {
      map.getCanvas().style.cursor = "pointer";
      const markerSquare =
        typeof event.features?.[0]?.properties?.square === "string"
          ? (event.features[0].properties.square as string)
          : null;
      const district = markerSquare ? districtsBySquareRef.current.get(markerSquare as Square) ?? null : null;
      onHighlightedDistrictChangeRef.current(district?.id ?? null);
    });
    map.on("mouseleave", markerLayerId, () => {
      map.getCanvas().style.cursor = "crosshair";
      onHighlightedDistrictChangeRef.current(null);
    });
    map.on("mouseleave", markerActiveLayerId, () => {
      map.getCanvas().style.cursor = "crosshair";
      onHighlightedDistrictChangeRef.current(null);
    });
    mapRef.current = map;
    hasHydratedCamera.current = false;

    return () => {
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
      syncDistrictMarkerLayers(map, cityBoard, activeSquare);
      map.resize();
    });
  }, [activeSquare, cityBoard, viewMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    syncDistrictMarkerLayers(map, cityBoard, activeSquare);
  }, [activeSquare, cityBoard, selectedDistrict?.mapAnchor]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (!hasHydratedCamera.current) {
      if (selectedDistrict?.mapAnchor) {
        map.jumpTo({
          center: selectedCenter,
          zoom: 13.75
        });
      } else {
        map.fitBounds(markerBounds, {
          padding: 36,
          duration: 0,
          maxZoom: 12
        });
      }
      hasHydratedCamera.current = true;
      return;
    }

    map.stop();
    if (selectedDistrict) {
      map.flyTo({
        center: selectedCenter,
        zoom: selectedDistrict.mapAnchor ? 13.75 : 12,
        duration: 500,
        essential: true
      });
      return;
    }

    map.fitBounds(markerBounds, {
      padding: 36,
      duration: 500,
      maxZoom: 12
    });
  }, [markerBounds, selectedCenter, selectedDistrict]);

  useEffect(() => {
    const map = mapRef.current;
    const node = mapContainerRef.current;
    if (!map || !node || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      map.resize();
    });
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="city-placement-editor__map">
      <div className="city-placement-editor__toolbar">
        <div className="city-placement-editor__toggle-group" role="group" aria-label="Map imagery">
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
        <div className="city-placement-editor__toolbar-actions">
          {selectedDistrict?.mapAnchor ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onMapAnchorChange(undefined)}
            >
              <MapPinOff />
              Clear anchor
            </Button>
          ) : null}
          <Button asChild type="button" size="sm" variant="outline">
            <a href={openUrl} target="_blank" rel="noreferrer">
              Open in OpenStreetMap
              <ExternalLink />
            </a>
          </Button>
        </div>
      </div>

      <div className="city-placement-editor__map-frame">
        <div ref={mapContainerRef} className="city-placement-editor__map-canvas" />
      </div>

      <div className="city-placement-editor__hint-row">
        <div className="city-placement-editor__hint">
          <Crosshair className="size-4" />
          {selectedDistrict
            ? importModeArmed
              ? "Click the map to import a reviewed anchor for the selected district."
              : "Hover markers to find districts. Click a marker to select it."
            : "Hover or click district markers to find the matching district entry."}
        </div>
        <div className="city-placement-editor__coordinates">
          {highlightedDistrict && highlightedDistrict.id !== selectedDistrict?.id ? (
            <Badge variant="outline">Highlight {highlightedDistrict.name}</Badge>
          ) : null}
          {selectedDistrict?.mapAnchor ? (
            <>
              <Badge variant="outline">
                Lon {selectedDistrict.mapAnchor.longitude.toFixed(5)}
              </Badge>
              <Badge variant="outline">
                Lat {selectedDistrict.mapAnchor.latitude.toFixed(5)}
              </Badge>
            </>
          ) : (
            <Badge variant="outline">Using generated placement</Badge>
          )}
        </div>
      </div>
    </div>
  );
}
