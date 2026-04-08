import type { CityBoard } from "@narrative-chess/content-schema";

export type CityMapProposalMarker = {
  id: string;
  name: string;
  label: string;
  coordinates: [number, number];
  square: string | null;
};

const edinburghProposalMarkers: CityMapProposalMarker[] = [
  {
    id: "proposal-old-town-south",
    name: "Old Town South",
    label: "Old Town S",
    coordinates: [-3.1895, 55.9462],
    square: null
  },
  {
    id: "proposal-grassmarket",
    name: "Grassmarket",
    label: "Grassmarket",
    coordinates: [-3.1965, 55.9473],
    square: null
  },
  {
    id: "proposal-bruntsfield-links",
    name: "Bruntsfield Links",
    label: "Bruntsfield",
    coordinates: [-3.2057, 55.9377],
    square: null
  }
];

export function getCityMapProposalMarkers(cityBoard: CityBoard) {
  if (cityBoard.id === "edinburgh") {
    return edinburghProposalMarkers;
  }

  return [];
}

export function createCityMapProposalGeoJson(cityBoard: CityBoard) {
  const markers = getCityMapProposalMarkers(cityBoard);

  return {
    type: "FeatureCollection" as const,
    features: markers.map((marker) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: marker.coordinates
      },
      properties: {
        id: marker.id,
        name: marker.name,
        label: marker.label,
        square: marker.square ?? ""
      }
    }))
  };
}

export function getCityMapProposalBounds(cityBoard: CityBoard) {
  const markers = getCityMapProposalMarkers(cityBoard);
  if (markers.length === 0) {
    return null;
  }

  let west = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;

  for (const marker of markers) {
    west = Math.min(west, marker.coordinates[0]);
    east = Math.max(east, marker.coordinates[0]);
    south = Math.min(south, marker.coordinates[1]);
    north = Math.max(north, marker.coordinates[1]);
  }

  return [
    [west, south],
    [east, north]
  ] as [[number, number], [number, number]];
}
