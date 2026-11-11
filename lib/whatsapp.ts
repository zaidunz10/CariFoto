export function normalizeWhatsAppNumber(value?: string) {
  if (!value) return "";

  const cleaned = value.replace(/\D/g, "");
  if (!cleaned) return "";

  if (cleaned.startsWith("62")) return cleaned;
  if (cleaned.startsWith("0")) return `62${cleaned.slice(1)}`;
  return cleaned;
}

export function buildWhatsAppMessage(
  sessionLocation: string | undefined,
  photos: Array<{ id: string; webViewLink?: string; name?: string }>,
) {
  if (photos.length === 1) {
    return `Halo, ini foto dari sesi ${sessionLocation || "foto"}: ${
      photos[0].webViewLink ||
      `https://drive.google.com/uc?export=view&id=${photos[0].id}`
    }`;
  }

  return `Halo, saya kirim ${photos.length} foto dari sesi ${sessionLocation || "foto"}:\n${photos
    .map(
      (photo, index) =>
        `${index + 1}. ${photo.webViewLink || `https://drive.google.com/uc?export=view&id=${photo.id}`}`,
    )
    .join("\n")}`;
}
