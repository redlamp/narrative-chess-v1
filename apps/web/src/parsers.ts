import type { MapAnchor, ReferenceLink } from "@narrative-chess/content-schema";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function readString(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

export function readNullableString(value: unknown, fallback: string | null) {
  return value === null || typeof value === "string" ? value : fallback;
}

export function readStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value.filter((item): item is string => typeof item === "string");
}

export function readTrimmedStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function readMapAnchor(value: unknown, fallback: MapAnchor | undefined) {
  if (!isRecord(value)) {
    return fallback;
  }

  const longitude = typeof value.longitude === "number" ? value.longitude : fallback?.longitude;
  const latitude = typeof value.latitude === "number" ? value.latitude : fallback?.latitude;

  if (longitude === undefined || latitude === undefined) {
    return fallback;
  }

  return { longitude, latitude };
}

export function readRadiusMeters(value: unknown, fallback: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function readYear(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsedValue = Number.parseInt(value, 10);
    if (Number.isInteger(parsedValue)) {
      return parsedValue;
    }
  }

  return fallback;
}

export function readReferenceLinks(value: unknown, fallback: ReferenceLink[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const nextLinks: ReferenceLink[] = [];

  value.forEach((candidate) => {
    if (!isRecord(candidate)) {
      return;
    }

    const label = readString(candidate.label, "").trim();
    const url = readString(candidate.url, "").trim();
    if (!label || !url) {
      return;
    }

    nextLinks.push({ label, url });
  });

  return nextLinks;
}
