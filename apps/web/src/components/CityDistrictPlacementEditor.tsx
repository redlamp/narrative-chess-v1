import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import MaplibreGeocoder from "@maplibre/maplibre-gl-geocoder";
import "@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css";
import { ExternalLink, Map as MapIcon, MapPinOff, Satellite } from "lucide-react";
import type { CityBoard, DistrictCell, Square } from "@narrative-chess/content-schema";
import { Button } from "@/components/ui/button";
import {
  buildOpenStreetMapUrl,
  createMapLibreRasterStyle,
  getCityBoardMarkerBounds,
  getDistrictMapCenter,
  getDistrictRadiusMeters,
  syncDistrictMapLayers,
  type MapViewMode
} from "./cityMapShared";

export type CityDistrictMapEditorProps = {
  cityBoard: CityBoard;
  selectedDistrict: DistrictCell | null;
  highlightedDistrict: DistrictCell | null;
  searchContainerRef: MutableRefObject<HTMLDivElement | null>;
  isEditable?: boolean;
  onMapAnchorChange: (anchor: DistrictCell["mapAnchor"]) => void;
  onHighlightedDistrictChange: (districtId: string | null) => void;
  onSelectDistrict: (districtId: string) => void;
  importModeArmed: boolean;
  onImportModeConsumed: () => void;
};

const markerSourceId = "city-review-district-markers";
const markerLayerId = "city-review-district-markers-layer";
const markerActiveLayerId = "city-review-district-markers-active-layer";
const markerLabelLayerId = "city-review-district-markers-label-layer";
const radiusSourceId = "city-review-district-radius";
const radiusFillLayerId = "city-review-district-radius-fill";
const radiusStrokeLayerId = "city-review-district-radius-stroke";
const searchResultSourceId = "city-review-search-result";
const searchResultLayerId = "city-review-search-result-layer";
const interactiveLayerIds = [
  markerLayerId,
  markerActiveLayerId,
  markerLabelLayerId,
  radiusFillLayerId,
  radiusStrokeLayerId
] as const;

type NominatimSearchResult = {
  type: "Feature";
  geometry: GeoJSON.Point;
  properties: {
    display_name: string;
    name?: string;
    category?: string;
    type?: string;
    addresstype?: string;
    place_id?: string | number;
  };
  bbox?: [number, number, number, number];
};

type GeocoderFeature = GeoJSON.Feature<GeoJSON.Point> & {
  text: string;
  place_name: string;
  place_type: string[];
  center: [number, number];
  bbox?: [number, number, number, number];
};

function createNominatimGeocoderApi() {
  return {
    forwardGeocode: async (config: {
      query?: string | number[];
      bbox?: number[];
      limit?: number;
      language?: string;
    }) => {
      if (typeof config.query !== "string" || config.query.trim().length === 0) {
        return {
          type: "FeatureCollection" as const,
          features: [] as GeocoderFeature[]
        };
      }

      const params = new URLSearchParams({
        q: config.query.trim(),
        format: "geojson",
        addressdetails: "1",
        "accept-language": config.language ?? "en",
        limit: `${Math.min(Math.max(config.limit ?? 5, 1), 10)}`
      });

      if (Array.isArray(config.bbox) && config.bbox.length === 4) {
        const [west, south, east, north] = config.bbox;
        params.set("viewbox", `${west},${south},${east},${north}`);
        params.set("bounded", "1");
      }

      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`Search failed with status ${response.status}`);
      }

      const results = (await response.json()) as {
        type: "FeatureCollection";
        features: NominatimSearchResult[];
      };
      const features = results.features
        .filter((result) => result.geometry?.type === "Point" && Array.isArray(result.geometry.coordinates))
        .map<GeocoderFeature>((result) => {
        const [longitude, latitude] = result.geometry.coordinates;
        return {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [longitude, latitude]
          },
          properties: {
            category: result.properties.category,
            type: result.properties.type,
            addresstype: result.properties.addresstype,
            place_id: result.properties.place_id
          },
          text:
            result.properties.name ??
            result.properties.display_name.split(",")[0]?.trim() ??
            result.properties.display_name,
          place_name: result.properties.display_name,
          place_type: [
            result.properties.addresstype ?? result.properties.type ?? result.properties.category ?? "place"
          ],
          center: [longitude, latitude],
          bbox: result.bbox
        };
      });

      return {
        type: "FeatureCollection" as const,
        features
      };
    }
  };
}

function getFeatureCenter(feature: GeocoderFeature) {
  if (feature.center) {
    return feature.center;
  }

  const [longitude, latitude] = feature.geometry.coordinates;
  return [longitude, latitude] as [number, number];
}

function getDistrictRadiusBounds(cityBoard: CityBoard, district: DistrictCell) {
  const [longitude, latitude] = getDistrictMapCenter(cityBoard, district);
  const radiusMeters = getDistrictRadiusMeters(district);
  const latitudeDelta = radiusMeters / 111320;
  const longitudeDelta = radiusMeters / (111320 * Math.max(0.01, Math.cos(latitude * Math.PI / 180)));

  return new maplibregl.LngLatBounds(
    [longitude - longitudeDelta, latitude - latitudeDelta],
    [longitude + longitudeDelta, latitude + latitudeDelta]
  );
}

function syncDistrictMarkerLayers(
  map: MapLibreMap,
  cityBoard: CityBoard,
  activeDistrict: DistrictCell | null
) {
  syncDistrictMapLayers({
    map,
    cityBoard,
    activeDistrict,
    layerIds: {
      markerSourceId,
      markerLayerId,
      markerActiveLayerId,
      markerLabelLayerId,
      radiusSourceId,
      radiusFillLayerId,
      radiusStrokeLayerId
    }
  });
}

function syncSearchResultLayer(map: MapLibreMap, feature: GeocoderFeature | null) {
  const data: GeoJSON.FeatureCollection<GeoJSON.Point> = {
    type: "FeatureCollection",
    features: feature
      ? [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: feature.geometry.coordinates
            },
            properties: {}
          }
        ]
      : []
  };

  const existingSource = map.getSource(searchResultSourceId) as GeoJSONSource | undefined;
  if (existingSource) {
    existingSource.setData(data);
    return;
  }

  map.addSource(searchResultSourceId, {
    type: "geojson",
    data
  });

  map.addLayer({
    id: searchResultLayerId,
    type: "circle",
    source: searchResultSourceId,
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        9,
        7,
        14,
        10
      ],
      "circle-color": "#fb7185",
      "circle-stroke-color": "#111827",
      "circle-stroke-width": 2,
      "circle-opacity": 0.95
    }
  });
}

export function CityDistrictMapEditor({
  cityBoard,
  selectedDistrict,
  highlightedDistrict,
  searchContainerRef,
  isEditable = true,
  onMapAnchorChange,
  onHighlightedDistrictChange,
  onSelectDistrict,
  importModeArmed,
  onImportModeConsumed
}: CityDistrictMapEditorProps) {
  const [viewMode, setViewMode] = useState<MapViewMode>("map");
  const [searchResultFeature, setSearchResultFeature] = useState<GeocoderFeature | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const geocoderRef = useRef<MaplibreGeocoder | null>(null);
  const searchResultFeatureRef = useRef<GeocoderFeature | null>(null);
  const hasHydratedCamera = useRef(false);
  const lastCameraDistrictIdRef = useRef<string | null>(selectedDistrict?.id ?? null);
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
  const cameraCenter = useMemo(
    () =>
      selectedDistrict
        ? getDistrictMapCenter(cityBoard, selectedDistrict)
        : [
            (markerBounds[0][0] + markerBounds[1][0]) / 2,
            (markerBounds[0][1] + markerBounds[1][1]) / 2
          ] as [number, number],
    [cityBoard, markerBounds, selectedDistrict]
  );
  const openUrl = useMemo(
    () =>
      buildOpenStreetMapUrl(
        selectedDistrict ? cameraCenter : getDistrictMapCenter(cityBoard, activeDistrict ?? cityBoard.districts[0]!),
        selectedDistrict?.mapAnchor ? 14 : 12
      ),
    [activeDistrict, cameraCenter, cityBoard, selectedDistrict]
  );

  useEffect(() => {
    geocoderRef.current?.clear();
    setSearchResultFeature(null);
  }, [cityBoard.id]);

  useEffect(() => {
    selectedDistrictRef.current = selectedDistrict;
    districtsBySquareRef.current = districtsBySquare;
    onMapAnchorChangeRef.current = onMapAnchorChange;
    onHighlightedDistrictChangeRef.current = onHighlightedDistrictChange;
    onSelectDistrictRef.current = onSelectDistrict;
    importModeArmedRef.current = importModeArmed;
    onImportModeConsumedRef.current = onImportModeConsumed;
    searchResultFeatureRef.current = searchResultFeature;
  }, [
    districtsBySquare,
    importModeArmed,
    onHighlightedDistrictChange,
    onImportModeConsumed,
    onMapAnchorChange,
    onSelectDistrict,
    searchResultFeature,
    selectedDistrict
  ]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: createMapLibreRasterStyle(viewMode),
      center: cameraCenter,
      zoom: selectedDistrict?.mapAnchor ? 13.75 : 11.5,
      attributionControl: {}
    });

    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    map.getCanvas().style.cursor = "crosshair";
    map.on("load", () => {
      syncDistrictMarkerLayers(map, cityBoard, activeDistrict);
      syncSearchResultLayer(map, searchResultFeatureRef.current);
    });
    map.on("click", (event) => {
      const markerFeature = map
        .queryRenderedFeatures(event.point, {
          layers: [...interactiveLayerIds]
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

      if (!isEditable || !selectedDistrictRef.current || !importModeArmedRef.current) {
        return;
      }

      onMapAnchorChangeRef.current({
        longitude: Number(event.lngLat.lng.toFixed(6)),
        latitude: Number(event.lngLat.lat.toFixed(6))
      });
      onImportModeConsumedRef.current();
    });
    map.on("mousemove", (event) => {
      const hoveredFeature = map
        .queryRenderedFeatures(event.point, {
          layers: [...interactiveLayerIds]
        })
        .find((feature) => typeof feature.properties?.square === "string");

      const hoveredSquare =
        typeof hoveredFeature?.properties?.square === "string"
          ? (hoveredFeature.properties.square as Square)
          : null;
      const district = hoveredSquare ? districtsBySquareRef.current.get(hoveredSquare) ?? null : null;

      map.getCanvas().style.cursor = district ? "pointer" : "crosshair";
      onHighlightedDistrictChangeRef.current(district?.id ?? null);
    });
    mapRef.current = map;
    hasHydratedCamera.current = false;

    return () => {
      geocoderRef.current?.onRemove();
      geocoderRef.current = null;
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
      syncDistrictMarkerLayers(map, cityBoard, activeDistrict);
      syncSearchResultLayer(map, searchResultFeatureRef.current);
      map.resize();
    });
  }, [viewMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    syncDistrictMarkerLayers(map, cityBoard, activeDistrict);
    syncSearchResultLayer(map, searchResultFeature);
  }, [activeDistrict, cityBoard, searchResultFeature, selectedDistrict?.mapAnchor]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (!hasHydratedCamera.current) {
      if (selectedDistrict?.mapAnchor) {
        map.jumpTo({
          center: cameraCenter,
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

    const selectedDistrictId = selectedDistrict?.id ?? null;
    const previousCameraDistrictId = lastCameraDistrictIdRef.current;
    const hasSelectionChanged = previousCameraDistrictId !== selectedDistrictId;
    lastCameraDistrictIdRef.current = selectedDistrictId;

    if (selectedDistrict) {
      if (hasSelectionChanged) {
        map.stop();
        map.flyTo({
          center: cameraCenter,
          zoom: selectedDistrict.mapAnchor ? 13.75 : 12,
          duration: 1000,
          essential: true,
          curve: 0.5,
          speed: 1
        });
        return;
      }

      const currentBounds = map.getBounds();
      const radiusBounds = getDistrictRadiusBounds(cityBoard, selectedDistrict);
      const mapCanvas = map.getCanvas();
      const centerPoint = map.project(cameraCenter);
      const edgePadding = 48;
      const isCenterVisible =
        currentBounds.contains(cameraCenter) &&
        centerPoint.x >= edgePadding &&
        centerPoint.x <= mapCanvas.clientWidth - edgePadding &&
        centerPoint.y >= edgePadding &&
        centerPoint.y <= mapCanvas.clientHeight - edgePadding;
      const isRadiusVisible =
        currentBounds.contains(radiusBounds.getSouthWest()) &&
        currentBounds.contains(radiusBounds.getNorthEast());

      if (!isCenterVisible) {
        map.panTo(cameraCenter, {
          duration: 120,
          essential: true
        });
        return;
      }

      if (!isRadiusVisible) {
        map.fitBounds(radiusBounds, {
          padding: 36,
          duration: 250,
          essential: true,
          maxZoom: 13.75
        });
      }
      return;
    }

    map.stop();
    map.fitBounds(markerBounds, {
      padding: 36,
      duration: 500,
      maxZoom: 12
    });
  }, [cameraCenter, cityBoard, markerBounds, selectedDistrict]);

  useEffect(() => {
    const container = searchContainerRef.current;
    if (!container || geocoderRef.current) {
      return;
    }

    const geocoder = new MaplibreGeocoder(createNominatimGeocoderApi(), {
      maplibregl,
      flyTo: false,
      marker: false,
      showResultMarkers: false,
      enableEventLogging: false,
      minLength: 2,
      limit: 5,
      showResultsWhileTyping: true,
      debounceSearch: 250,
      placeholder: "Search Places",
      bbox: [markerBounds[0][0], markerBounds[0][1], markerBounds[1][0], markerBounds[1][1]]
    });

    geocoder.on("result", ({ result }) => {
      const map = mapRef.current;
      if (!map) {
        return;
      }

      const feature = result as GeocoderFeature;
      const geometryCoordinates = feature.geometry?.coordinates;
      const center =
        Array.isArray(geometryCoordinates) &&
        geometryCoordinates.length >= 2 &&
        Number.isFinite(geometryCoordinates[0]) &&
        Number.isFinite(geometryCoordinates[1])
          ? [geometryCoordinates[0], geometryCoordinates[1]] as [number, number]
          : getFeatureCenter(feature);
      const resolvedFeature: GeocoderFeature = {
        ...feature,
        geometry: {
          type: "Point",
          coordinates: center
        },
        center
      };
      setSearchResultFeature(resolvedFeature);

      map.stop();
      if (resolvedFeature.bbox) {
        map.fitBounds(
          [
            [resolvedFeature.bbox[0], resolvedFeature.bbox[1]],
            [resolvedFeature.bbox[2], resolvedFeature.bbox[3]]
          ],
          {
            padding: 48,
            duration: 1000,
            essential: true,
            maxZoom: 14
          }
        );
        return;
      }

      map.flyTo({
        center,
        zoom: 14,
        duration: 1000,
        essential: true,
        curve: 0.5,
        speed: 1
      });
    });

    geocoder.on("loading", () => {
      setSearchResultFeature(null);
    });

    geocoder.on("clear", () => {
      setSearchResultFeature(null);
    });

    geocoder.on("error", ({ error }) => {
      console.warn("Unable to search map location", error);
    });

    container.replaceChildren();
    geocoder.addTo(container);
    const input = container.querySelector<HTMLInputElement>(".maplibregl-ctrl-geocoder--input");
    if (input) {
      input.type = "text";
      input.spellcheck = false;
    }
    geocoderRef.current = geocoder;

    return () => {
      geocoder.onRemove();
      geocoderRef.current = null;
    };
  }, [markerBounds, searchContainerRef]);

  useEffect(() => {
    geocoderRef.current?.setBbox([markerBounds[0][0], markerBounds[0][1], markerBounds[1][0], markerBounds[1][1]]);
    geocoderRef.current?.setGeocoderApi(createNominatimGeocoderApi());
  }, [markerBounds]);

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
      <div className="city-placement-editor__map-frame">
        <div ref={mapContainerRef} className="city-placement-editor__map-canvas" />
      </div>

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
              disabled={!isEditable}
              onClick={() => onMapAnchorChange(undefined)}
            >
              <MapPinOff />
              Clear anchor
            </Button>
          ) : null}
          <Button asChild type="button" size="sm" variant="outline">
            <a href={openUrl} target="_blank" rel="noreferrer">
              Source
              <ExternalLink />
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
