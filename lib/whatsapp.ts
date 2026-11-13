export function normalizeWhatsAppNumber(value?: string) {
  if (!value) return "";

  const cleaned = value.replace(/\D/g, "");
  if (!cleaned) return "";

  if (cleaned.startsWith("62")) return cleaned;
  if (cleaned.startsWith("0")) return `62${cleaned.slice(1)}`;
  return cleaned;
}

function formatSessionDayDate(dateStr?: string) {
  if (!dateStr) return "";

  const value = dateStr.slice(0, 10);
  if (!value || value === "null") return "";

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

export function buildWhatsAppMessage({
  sessionLocation,
  sessionDate,
  instagramLink,
  currentSubfolder,
  photos,
}: {
  sessionLocation?: string;
  sessionDate?: string;
  instagramLink?: string;
  currentSubfolder?: string;
  photos: Array<{ id: string; webViewLink?: string; name?: string }>;
}) {
  const instagramHandle = (instagramLink ?? "").trim().replace(/^@/, "");
  const dayDateFormatted = formatSessionDayDate(sessionDate);
  const fileList = photos
    .map((photo, index) => `${index + 1}. *${photo.name || `Foto ${index + 1}`}*`)
    .join("\n");

  const header = instagramHandle
    ? `Halo kak @${instagramHandle}! 💬\n\n`
    : "Halo kak! 💬\n\n";

  const locationText = `📍 Lokasi: *${sessionLocation || "Lokasi Hunting"}*\n`;
  const dateText = dayDateFormatted
    ? `📅 Hari & Tanggal: *${dayDateFormatted}*\n`
    : "";
  const folderText = currentSubfolder
    ? `⏰ Jam EXIF: *${currentSubfolder}*\n`
    : "";

  return `${header}Saya mau pesan/beli foto jepretan di:\n${locationText}${dateText}${folderText}\n📄 Daftar Foto (${photos.length} foto):\n${fileList}`;
}
