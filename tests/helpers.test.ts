import test from "node:test";
import assert from "node:assert/strict";
import {
  extractFolderId,
  getPhotoImageUrl,
  getPlateMatchScore,
  matchesPlateQuery,
  parseTimeToMinutes,
  sanitizeDownloadFilename,
  sanitizePlateSearchInput,
} from "../lib/drive";
import {
  buildWhatsAppMessage,
  formatSessionDayDate,
  normalizeWhatsAppNumber,
} from "../lib/whatsapp";

test("extractFolderId handles URLs with query params, account index, and raw IDs", () => {
  assert.equal(
    extractFolderId(
      "https://drive.google.com/drive/folders/1nF5doNHxiYblP0yo50_gXkDc3xeM-USw?hl=ID",
    ),
    "1nF5doNHxiYblP0yo50_gXkDc3xeM-USw",
  );
  assert.equal(
    extractFolderId(
      "https://drive.google.com/drive/u/1/folders/1O8FMi-IQ_6Ww3hV04F4rWZavbMFv4Kla",
    ),
    "1O8FMi-IQ_6Ww3hV04F4rWZavbMFv4Kla",
  );
  assert.equal(
    extractFolderId("1rCaJk-JHAcbjDYBF74tVqr2sTLBOiDvu"),
    "1rCaJk-JHAcbjDYBF74tVqr2sTLBOiDvu",
  );
  assert.equal(extractFolderId(""), null);
  assert.equal(extractFolderId("invalid id with spaces!"), null);
});

test("getPhotoImageUrl updates size suffix or falls back to drive thumbnail", () => {
  assert.equal(
    getPhotoImageUrl(
      {
        id: "abc123",
        thumbnailLink: "https://lh3.googleusercontent.com/xyz=s220",
      },
      1200,
    ),
    "https://lh3.googleusercontent.com/xyz=s1200",
  );
  assert.equal(
    getPhotoImageUrl({ id: "abc123" }, 800),
    "https://drive.google.com/thumbnail?id=abc123&sz=w800",
  );
});

test("parseTimeToMinutes validates EXIF times", () => {
  assert.equal(parseTimeToMinutes("06:57:25"), 6 * 60 + 57);
  assert.equal(parseTimeToMinutes("07.15"), 7 * 60 + 15);
  assert.equal(parseTimeToMinutes("25:00"), null);
  assert.equal(parseTimeToMinutes(null), null);
});

test("plate sanitization, partial/token matching, and relevance scoring work cleanly", () => {
  assert.equal(sanitizePlateSearchInput("D 5421, (test)*"), "D 5421 test");
  assert.equal(matchesPlateQuery("D 5437 XY", "437"), true);
  assert.equal(matchesPlateQuery("D 4370 AB", "437"), true);
  assert.equal(matchesPlateQuery("D 5437 XY", "D 437"), true);
  assert.equal(matchesPlateQuery("B 4370 D", "D 437"), false);
  assert.equal(matchesPlateQuery("D 2298 LK", "d2298"), true);
  assert.equal(matchesPlateQuery("D 2298 LK", "B 1234"), false);
  assert.equal(matchesPlateQuery("D 5437 XY", "!!!"), false);

  const exactPlateScore = getPlateMatchScore("D 437 XY", "437");
  const prefixTokenScore = getPlateMatchScore("D 4370 AB", "437");
  const substringScore = getPlateMatchScore("D 5437 XY", "437");
  const orderedTokenScore = getPlateMatchScore("D 5437 XY", "D 437");
  assert.ok(exactPlateScore < prefixTokenScore);
  assert.ok(prefixTokenScore < substringScore);
  assert.ok(substringScore < orderedTokenScore);
});

test("sanitizeDownloadFilename removes unsafe characters", () => {
  assert.equal(sanitizeDownloadFilename('IMG_1473?.jpg\r\n'), "IMG_1473_.jpg");
  assert.equal(sanitizeDownloadFilename(""), "photo.jpg");
});

test("whatsapp helpers normalize Indonesian numbers and build order message", () => {
  assert.equal(normalizeWhatsAppNumber("0823-3339-6987"), "6282333396987");
  assert.equal(normalizeWhatsAppNumber("+62 857 5958 2599"), "6285759582599");
  assert.equal(normalizeWhatsAppNumber(""), "");

  assert.ok(formatSessionDayDate("2026-11-22").includes("2026"));

  const msg = buildWhatsAppMessage({
    sessionLocation: "Ciwidey",
    sessionDate: "2026-11-22",
    instagramLink: "@aston.pein",
    currentSubfolder: "07:00",
    photos: [{ id: "1", name: "IMG_1473.JPG" }],
  });
  assert.ok(msg.includes("@aston.pein"));
  assert.ok(msg.includes("Ciwidey"));
  assert.ok(msg.includes("07:00"));
  assert.ok(msg.includes("IMG_1473.JPG"));
});
