import { NextRequest, NextResponse } from "next/server";
import { sanitizeDownloadFilename } from "@/lib/drive";

export async function GET(request: NextRequest) {
  const fileId = request.nextUrl.searchParams.get("id");
  const requestedName = request.nextUrl.searchParams.get("name");
  const safeFilename = sanitizeDownloadFilename(requestedName);

  try {

    if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
      return NextResponse.json(
        { error: "ID foto tidak valid" },
        { status: 400 },
      );
    }

    const apiKey =
      process.env.GOOGLE_DRIVE_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY;

    let response: Response | null = null;

    // 1. Coba unduh via Google Drive REST API v3 jika API key tersedia
    if (apiKey) {
      const driveApiUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true&key=${encodeURIComponent(apiKey)}`;
      const apiResponse = await fetch(driveApiUrl, {
        cache: "no-store",
      });

      if (apiResponse.ok) {
        response = apiResponse;
      } else {
        const errorDetail = await apiResponse.text().catch(() => "");
        console.warn("Google Drive API v3 fallback triggered:", {
          status: apiResponse.status,
          fileId,
          detail: errorDetail.slice(0, 300),
        });
      }
    }

    // 2. Fallback ke direct download endpoint publik jika API v3 gagal atau key tidak tersedia
    if (!response) {
      const directUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
      const fallbackResponse = await fetch(directUrl, {
        cache: "no-store",
        redirect: "follow",
      });

      const fallbackType = fallbackResponse.headers.get("content-type") || "";
      if (fallbackResponse.ok && fallbackType.startsWith("image/")) {
        response = fallbackResponse;
      } else {
        return NextResponse.json(
          {
            error: "Google Drive gagal mengirim foto",
            status: fallbackResponse.status,
          },
          { status: fallbackResponse.ok ? 502 : fallbackResponse.status },
        );
      }
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
      "Cache-Control": "no-store",
    };

    const contentLength = response.headers.get("content-length");
    if (contentLength) {
      headers["Content-Length"] = contentLength;
    }

    return new NextResponse(response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Drive download error:", error);

    return NextResponse.json(
      { error: "Terjadi kesalahan pada server download" },
      { status: 500 },
    );
  }
}
