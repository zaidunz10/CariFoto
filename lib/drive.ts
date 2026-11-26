import type { DriveItem } from "./types";

const DRIVE_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

/**
 * Extracts and validates a Google Drive folder ID from either a full Drive URL
 * (including /u/1/folders/... and ?hl=ID variants) or a raw folder ID string.
 */
export function extractFolderId(urlOrId?: string | null): string | null {
  if (!urlOrId) return null;

  const trimmed = urlOrId.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  if (trimmed.includes("/folders/")) {
    candidate = trimmed.split("/folders/")[1]?.split("?")[0]?.split("/")[0] || "";
  }

  return DRIVE_ID_REGEX.test(candidate) ? candidate : null;
}

/**
 * Resolves a thumbnail URL for a Google Drive image item at the requested size.
 */
export function getPhotoImageUrl(
  photo: Pick<DriveItem, "id" | "thumbnailLink">,
  size: number = 800,
): string {
  if (photo.thumbnailLink) {
    return photo.thumbnailLink.replace(/=s\d+.*$/, `=s${size}`);
  }
  return `https://drive.google.com/thumbnail?id=${photo.id}&sz=w${size}`;
}

/**
 * Parses an EXIF time string ("HH:MM:SS", "HH:MM", or "HH.MM") into minutes since midnight.
 */
export function parseTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null;

  const match = timeStr.trim().match(/^(\d{1,2})[:.](\d{2})/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

/**
 * Strips special characters while keeping alphanumeric characters and spaces.
 */
export function sanitizePlateSearchInput(value: string): string {
  return value.replace(/[^a-zA-Z0-9\s]/g, "").trim();
}

/**
 * Scores how closely a plate number matches a user query (-1 = no match, 0 = exact).
 * Supports partial digits (e.g. "437" matches "D 5437") and ordered tokens (e.g. "D 437" matches "D 5437").
 */
export function getPlateMatchScore(
  plateNumber: string | null | undefined,
  query: string,
): number {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return 0;

  const cleanedQuery = sanitizePlateSearchInput(trimmedQuery).toLowerCase();
  const queryTokens = cleanedQuery.split(/\s+/).filter(Boolean);
  const compactNeedle = queryTokens.join("");
  if (!compactNeedle) return -1;

  const rawPlate = sanitizePlateSearchInput(plateNumber || "").toLowerCase();
  const plateTokens = rawPlate.split(/\s+/).filter(Boolean);
  const normalizedPlate = plateTokens.join("");
  if (!normalizedPlate) return -1;

  if (normalizedPlate === compactNeedle) return 0;
  if (plateTokens.some((token) => token === compactNeedle)) return 1;
  if (
    plateTokens.some((token) => token.startsWith(compactNeedle)) ||
    normalizedPlate.startsWith(compactNeedle)
  ) {
    return 2;
  }
  if (normalizedPlate.includes(compactNeedle)) return 3;

  if (queryTokens.length > 1) {
    let cursor = 0;
    const allInOrder = queryTokens.every((token) => {
      const idx = normalizedPlate.indexOf(token, cursor);
      if (idx === -1) return false;
      cursor = idx + token.length;
      return true;
    });
    if (allInOrder) return 4;
  }

  return -1;
}

/**
 * Checks whether a plate number matches a user query regardless of whitespace or casing.
 */
export function matchesPlateQuery(
  plateNumber: string | null | undefined,
  query: string,
): boolean {
  return getPlateMatchScore(plateNumber, query) >= 0;
}

/**
 * Sanitizes a filename for HTTP Content-Disposition attachment headers.
 */
export function sanitizeDownloadFilename(name?: string | null): string {
  const base = (name || "")
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/[\r\n]/g, "")
    .trim();

  return base || "photo.jpg";
}
