import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ExternalLink, Map, Satellite } from "lucide-react";
import type { CityBoard, DistrictCell, MoveRecord } from "@narrative-chess/content-schema";
import { Button } from "@/components/ui/button";
import {
  buildOpenStreetMapUrl,
  createDistrictMarkerGeoJson,
  createMapLibreRasterStyle,
  getCityBoardMarkerBounds,
  getActiveCityMapLocation,
  type MapViewMode
} from "./cityMapShared";
import { createCityMapProposalGeoJson, getCityMapProposalBounds } from "./cityMapPlanning";

type CityMapLibrePanelProps = {
  cityBoard: CityBoard;
  selectedDistrict: DistrictCell | null;
  hoveredDistrict: DistrictCell | null;
  lastMoveDistrict: DistrictCell | null;
  lastMove: MoveRecord | null;
};

const districtMarkerSourceId = "district-markers";
const districtMarkerLayerId = "district-markers-layer";
const districtMarkerActiveLayerId = "district-markers-active-layer";
const districtMarkerLabelLayerId = "district-markers-label-layer";
const proposalMarkerSourceId = "proposal-markers";
const proposalMarkerLayerId = "proposal-markers-layer";
const proposalLabelLayerId = "proposal-markers-label-layer";

function syncDistrictMarkerLayers(map: MapLibreMap, cityBoard: CityBoard, activeSquare: string | null) {
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
      "circle-color": "#ffffff",
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

function syncProposalMarkerLayers(map: MapLibreMap, cityBoard: CityBoard) {
  const proposalData = createCityMapProposalGeoJson(cityBoard);
  const existingSource = map.getSource(proposalMarkerSourceId) as GeoJSONSource | undefined;

  if (existingSource) {
    existingSource.setData(proposalData);
    return;
  }

  map.addSource(proposalMarkerSourceId, {
    type: "geojson",
    data: proposalData
  });

  map.addLayer({
    id: proposalMarkerLayerId,
    type: "circle",
    source: proposalMarkerSourceId,
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        4,
        14,
        6
      ],
      "circle-color": "#7c3aed",
      "circle-stroke-width": 1.5,
      "circle-stroke-color": "#ffffff",
      "circle-opacity": 0.95
    }
  });

  map.addLayer({
    id: proposalLabelLayerId,
    type: "symbol",
    source: proposalMarkerSourceId,
    layout: {
      "text-field": ["get", "label"],
      "text-size": 10,
      "text-font": ["Arial Unicode MS Regular"],
      "text-offset": [0, -1.35],
      "text-anchor": "bottom",
      "text-allow-overlap": false,
      "text-ignore-placement": false
    },
    paint: {
      "text-color": "#111827",
      "text-halo-color": "rgba(255,255,255,0.95)",
      "text-halo-width": 1.25
    },
    minzoom: 11.5
  });
}

function mergeBounds(
  boundsA: [[number, number], [number, number]],
  boundsB: [[number, number], [number, number]] | null
) {
  if (!boundsB) {
    return boundsA;
  }

  return [
    [Math.min(boundsA[0][0], boundsB[0][0]), Math.min(boundsA[0][1], boundsB[0][1])],
    [Math.max(boundsA[1][0], boundsB[1][0]), Math.max(boundsA[1][1], boundsB[1][1])]
  ] as [[number, number], [number, number]];
}

export function CityMapLibrePanel({
  cityBoard,
  selectedDistrict,
  hoveredDistrict,
  lastMoveDistrict,
  lastMove
}: CityMapLibrePanelProps) {
  const [viewMode, setViewMode] = useState<MapViewMode>("map");
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const hasHydratedCamera = useRef(false);
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
  const cameraSquare = selectedDistrict?.square ?? null;
  const cityBoardBounds = useMemo(() => getCityBoardMarkerBounds(cityBoard), [cityBoard]);
  const proposalBounds = useMemo(() => getCityMapProposalBounds(cityBoard), [cityBoard]);
  const mapFrameBounds = useMemo(
    () => mergeBounds(cityBoardBounds, proposalBounds),
    [cityBoardBounds, proposalBounds]
  );
  const openUrl = useMemo(
    () => buildOpenStreetMapUrl(activeLocation.center, Math.round(activeLocation.zoom)),
    [activeLocation.center, activeLocation.zoom]
  );

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

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
      syncDistrictMarkerLayers(map, cityBoard, highlightedSquare);
      syncProposalMarkerLayers(map, cityBoard);
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
      syncDistrictMarkerLayers(map, cityBoard, highlightedSquare);
      syncProposalMarkerLayers(map, cityBoard);
      map.resize();
    });
  }, [cityBoard, highlightedSquare, viewMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    syncDistrictMarkerLayers(map, cityBoard, highlightedSquare);
    syncProposalMarkerLayers(map, cityBoard);
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
          zoom: activeLocation.zoom
        });
      } else {
        map.fitBounds(mapFrameBounds, {
          padding: 40,
          duration: 0,
          maxZoom: 12.25
        });
      }
      hasHydratedCamera.current = true;
      return;
    }

    map.stop();

    if (cameraSquare) {
      map.flyTo({
        center: activeLocation.center,
        zoom: activeLocation.zoom,
        duration: 1000,
        essential: true,
        curve: 0.5,
        speed: 1
      });
      return;
    }

    map.fitBounds(mapFrameBounds, {
      padding: 40,
      duration: 500,
      essential: true,
      maxZoom: 12.25
    });
  }, [activeLocation.center, activeLocation.zoom, cameraSquare, mapFrameBounds]);

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
        <div ref={mapContainerRef} className="city-maplibre-panel__canvas" />
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
            Open In OpenStreetMap
            <ExternalLink />
          </a>
        </Button>
      </div>
    </div>
  );
}
