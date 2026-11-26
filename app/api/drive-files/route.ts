import { NextRequest, NextResponse } from "next/server";
import type { DriveItem } from "@/lib/types";

const FOLDER_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const MAX_DRIVE_PAGES = 10;

interface DriveApiListResponse {
  nextPageToken?: string;
  files?: DriveItem[];
  error?: {
    code?: number;
    message?: string;
  };
}

function getReadableDriveError(status: number, rawMessage?: string): string {
  if (status === 403) {
    if (rawMessage?.toLowerCase().includes("quota") || rawMessage?.toLowerCase().includes("rate")) {
      return "Kuota Google Drive API sedang penuh. Silakan coba lagi beberapa saat.";
    }
    return "Folder Google Drive tidak dapat diakses. Pastikan folder diset publik.";
  }
  if (status === 404) {
    return "Folder Google Drive tidak ditemukan.";
  }
  if (status === 429) {
    return "Terlalu banyak permintaan ke Google Drive. Silakan coba lagi sebentar.";
  }
  return "Gagal memuat isi folder Google Drive.";
}

export async function GET(request: NextRequest) {
  const folderId = request.nextUrl.searchParams.get("folderId");

  try {

    if (!folderId || !FOLDER_ID_REGEX.test(folderId)) {
      return NextResponse.json(
        { error: "ID folder Google Drive tidak valid." },
        { status: 400 },
      );
    }

    const apiKey =
      process.env.GOOGLE_DRIVE_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Google Drive API key belum dikonfigurasi di server." },
        { status: 500 },
      );
    }

    const query = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
    const fields = encodeURIComponent(
      "nextPageToken,files(id,name,mimeType,thumbnailLink,webViewLink)",
    );

    const allFiles: DriveItem[] = [];
    let pageToken = "";

    for (let page = 0; page < MAX_DRIVE_PAGES; page += 1) {
      const tokenParam = pageToken
        ? `&pageToken=${encodeURIComponent(pageToken)}`
        : "";
      const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&key=${encodeURIComponent(apiKey)}&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true${tokenParam}`;

      const res = await fetch(url, { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as DriveApiListResponse;

      if (!res.ok) {
        const message = getReadableDriveError(res.status, json?.error?.message);
        console.error("Google Drive List API Error:", {
          status: res.status,
          detail: json?.error?.message,
          folderId,
        });
        return NextResponse.json({ error: message }, { status: res.status });
      }

      if (json.files?.length) {
        allFiles.push(...json.files);
      }

      if (!json.nextPageToken) break;
      pageToken = json.nextPageToken;
    }

    const folders = allFiles
      .filter((item) => item.mimeType === "application/vnd.google-apps.folder")
      .sort((a, b) => a.name.localeCompare(b.name));

    const photos = allFiles
      .filter((item) => item.mimeType.startsWith("image/"))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(
      {
        folders,
        photos,
        totalCount: allFiles.length,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Drive files route error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat membaca folder Google Drive." },
      { status: 500 },
    );
  }
}
