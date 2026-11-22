import { NextRequest, NextResponse } from "next/server";

const FALLBACK_DRIVE_API_KEY = "AIzaSyCr0nZXdPz9hV9TCBpzEdSxOmXovqGCMCg";

export async function GET(request: NextRequest) {
  try {
    const fileId = request.nextUrl.searchParams.get("id");

    if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
      return NextResponse.json(
        { error: "ID foto tidak valid" },
        { status: 400 }
      );
    }

    const apiKey =
      process.env.GOOGLE_DRIVE_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY ||
      FALLBACK_DRIVE_API_KEY;

    // 1. Coba unduh via Google Drive REST API v3
    const driveApiUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
    let response = await fetch(driveApiUrl, {
      cache: "no-store",
    });

    // 2. Fallback ke direct download endpoint jika API v3 mengembalikan 403/404
    if (!response.ok) {
      const directUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
      const fallbackResponse = await fetch(directUrl, {
        cache: "no-store",
        redirect: "follow",
      });

      const fallbackType = fallbackResponse.headers.get("content-type") || "";
      if (fallbackResponse.ok && fallbackType.startsWith("image/")) {
        response = fallbackResponse;
      } else {
        const errorDetail = await response.text();
        console.error("Google Drive API Error:", {
          status: response.status,
          detail: errorDetail,
          fileId,
        });

        return NextResponse.json(
          {
            error: "Google Drive gagal mengirim foto",
            status: response.status,
            detail: errorDetail,
          },
          { status: response.status }
        );
      }
    }

    const contentType =
      response.headers.get("content-type") || "image/jpeg";

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": 'attachment; filename="photo.jpg"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Drive download error:", error);

    return NextResponse.json(
      { error: "Terjadi kesalahan pada server download" },
      { status: 500 }
    );
  }
}