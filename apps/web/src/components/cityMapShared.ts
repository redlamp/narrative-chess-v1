import type { CityBoard, DistrictCell, MoveRecord } from "@narrative-chess/content-schema";
import type { StyleSpecification } from "maplibre-gl";

export type MapViewMode = "map" | "satellite";

export type ActiveCityMapLocation = {
  center: [number, number];
  query: string;
  openQuery: string;
  zoom: number;
  title: string;
  squareLabel: string | null;
};

type CityBounds = {
  west: number;
  east: number;
  south: number;
  north: number;
  center: [number, number];
};

const edinburghBounds: CityBounds = {
  west: -3.33,
  east: -3.08,
  south: 55.88,
  north: 55.995,
  center: [-3.1883, 55.9533]
};

const londonBounds: CityBounds = {
  west: -0.34,
  east: 0.08,
  south: 51.45,
  north: 51.58,
  center: [-0.1276, 51.5072]
};

const edinburghDistrictAnchors: Record<string, [number, number]> = {
  "edinburgh-cramond": [-3.3002, 55.9748],
  "edinburgh-stockbridge": [-3.2095, 55.9586],
  "edinburgh-haymarket": [-3.2217, 55.9457],
  "edinburgh-west-end": [-3.2105, 55.9489],
  "edinburgh-new-town-west": [-3.2015, 55.9548],
  "edinburgh-new-town-east": [-3.1845, 55.956],
  "edinburgh-broughton": [-3.1886, 55.9594],
  "edinburgh-leith-walk": [-3.1735, 55.9645],
  "edinburgh-leith-shore": [-3.1766, 55.9752],
  "edinburgh-leith": [-3.1724, 55.9684],
  "edinburgh-easter-road": [-3.1702, 55.9608],
  "edinburgh-tollcross": [-3.2036, 55.9444],
  "edinburgh-old-town-north": [-3.1905, 55.951],
  "edinburgh-southside-west": [-3.1886, 55.9426],
  "edinburgh-southside-east": [-3.1795, 55.9422],
  "edinburgh-morningside": [-3.2075, 55.9288],
  "edinburgh-portobello": [-3.1148, 55.9529]
};

function getCityBounds(cityBoard: CityBoard): CityBounds {
  if (cityBoard.id === "edinburgh") {
    return edinburghBounds;
  }

  if (cityBoard.id === "london") {
    return londonBounds;
  }

  return edinburghBounds;
}

function parseSquare(square: string) {
  const file = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = Number.parseInt(square.slice(1), 10) - 1;
  if (!Number.isFinite(file) || !Number.isFinite(rank) || file < 0 || file > 7 || rank < 0 || rank > 7) {
    return null;
  }

  return { file, rank };
}

export function getBoardSquareCenter(cityBoard: CityBoard, square: string): [number, number] {
  const parsedSquare = parseSquare(square);
  const bounds = getCityBounds(cityBoard);
  if (!parsedSquare) {
    return bounds.center;
  }

  const fileFraction = (parsedSquare.file + 0.5) / 8;
  const rankFraction = (parsedSquare.rank + 0.5) / 8;
  const longitude = bounds.west + (bounds.east - bounds.west) * fileFraction;
  const latitude = bounds.south + (bounds.north - bounds.south) * rankFraction;

  return [longitude, latitude];
}

export function getDistrictMapCenter(cityBoard: CityBoard, district: DistrictCell): [number, number] {
  if (district.mapAnchor) {
    return [district.mapAnchor.longitude, district.mapAnchor.latitude];
  }

  if (cityBoard.id === "edinburgh") {
    const anchor = edinburghDistrictAnchors[district.id];
    if (anchor) {
      return anchor;
    }
  }

  return getBoardSquareCenter(cityBoard, district.square);
}

export function buildDistrictQuery(cityBoard: CityBoard, district: DistrictCell) {
  const queryParts = [
    district.landmarks[0] ?? null,
    district.name,
    cityBoard.name,
    cityBoard.country
  ].filter((part, index, values): part is string => Boolean(part) && values.indexOf(part) === index);

  return queryParts.join(", ");
}

export function buildGoogleEmbedUrl(query: string, viewMode: MapViewMode, zoom: number) {
  const params = new URLSearchParams({
    q: query,
    z: String(zoom),
    t: viewMode === "satellite" ? "k" : "m",
    output: "embed"
  });

  return `https://www.google.com/maps?${params.toString()}`;
}

export function buildGoogleOpenUrl(query: string) {
  const params = new URLSearchParams({
    api: "1",
    query
  });

  return `https://www.google.com/maps/search/?${params.toString()}`;
}

export function buildOpenStreetMapUrl(center: [number, number], zoom: number) {
  const [longitude, latitude] = center;
  const params = new URLSearchParams({
    mlon: longitude.toFixed(5),
    mlat: latitude.toFixed(5)
  });

  return `https://www.openstreetmap.org/?${params.toString()}#map=${zoom}/${latitude.toFixed(5)}/${longitude.toFixed(5)}`;
}

export function getActiveCityMapLocation(input: {
  cityBoard: CityBoard;
  selectedDistrict: DistrictCell | null;
  hoveredDistrict: DistrictCell | null;
  lastMoveDistrict: DistrictCell | null;
  lastMove: MoveRecord | null;
}): ActiveCityMapLocation {
  const { cityBoard, selectedDistrict, hoveredDistrict, lastMoveDistrict, lastMove } = input;

  if (selectedDistrict) {
    return {
      center: getDistrictMapCenter(cityBoard, selectedDistrict),
      query: buildDistrictQuery(cityBoard, selectedDistrict),
      openQuery: buildDistrictQuery(cityBoard, selectedDistrict),
      zoom: 14.75,
      title: selectedDistrict.name,
      squareLabel: selectedDistrict.square
    };
  }

  if (hoveredDistrict) {
    return {
      center: getCityBounds(cityBoard).center,
      query: `${cityBoard.name}, ${cityBoard.country}`,
      openQuery: buildDistrictQuery(cityBoard, hoveredDistrict),
      zoom: 11.5,
      title: hoveredDistrict.name,
      squareLabel: hoveredDistrict.square
    };
  }

  if (lastMoveDistrict && lastMove) {
    return {
      center: getCityBounds(cityBoard).center,
      query: `${cityBoard.name}, ${cityBoard.country}`,
      openQuery: buildDistrictQuery(cityBoard, lastMoveDistrict),
      zoom: 11.5,
      title: lastMoveDistrict.name,
      squareLabel: lastMove.to
    };
  }

  const bounds = getCityBounds(cityBoard);
  return {
    center: bounds.center,
    query: `${cityBoard.name}, ${cityBoard.country}`,
    openQuery: `${cityBoard.name}, ${cityBoard.country}`,
    zoom: 11.5,
    title: cityBoard.name,
    squareLabel: null
  };
}

export function createMapLibreRasterStyle(viewMode: MapViewMode): StyleSpecification {
  const sourceId = viewMode === "satellite" ? "esri-world-imagery" : "osm-standard";
  const tiles =
    viewMode === "satellite"
      ? ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"]
      : ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"];
  const attribution =
    viewMode === "satellite"
      ? "Imagery copyright Esri"
      : 'Map data copyright <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  return {
    version: 8,
    sources: {
      [sourceId]: {
        type: "raster",
        tiles,
        tileSize: 256,
        attribution
      }
    },
    layers: [
      {
        id: sourceId,
        type: "raster",
        source: sourceId,
        paint: {}
      }
    ]
  };
}

export function createDistrictMarkerGeoJson(input: {
  cityBoard: CityBoard;
  activeSquare: string | null;
}) {
  const { cityBoard, activeSquare } = input;

  return {
    type: "FeatureCollection" as const,
    features: cityBoard.districts.map((district) => {
      const [longitude, latitude] = getDistrictMapCenter(cityBoard, district);

      return {
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [longitude, latitude] as [number, number]
        },
        properties: {
          id: district.id,
          square: district.square,
          name: district.name,
          locality: district.locality,
          isActive: district.square === activeSquare ? 1 : 0
        }
      };
    })
  };
}

export function getCityBoardMarkerBounds(cityBoard: CityBoard) {
  let west = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;

  for (const district of cityBoard.districts) {
    const [longitude, latitude] = getDistrictMapCenter(cityBoard, district);
    west = Math.min(west, longitude);
    east = Math.max(east, longitude);
    south = Math.min(south, latitude);
    north = Math.max(north, latitude);
  }

  if (!Number.isFinite(west) || !Number.isFinite(east) || !Number.isFinite(south) || !Number.isFinite(north)) {
    const fallback = getCityBounds(cityBoard);
    return [
      [fallback.west, fallback.south],
      [fallback.east, fallback.north]
    ] as [[number, number], [number, number]];
  }

  return [
    [west, south],
    [east, north]
  ] as [[number, number], [number, number]];
}
