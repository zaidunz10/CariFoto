
import { NextRequest, NextResponse } from "next/server";

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
      process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "GOOGLE_DRIVE_API_KEY belum tersedia di environment. Tambahkan di .env.local atau Vercel env.",
        },
        { status: 500 }
      );
    }

    const driveUrl =
      `https://www.googleapis.com/drive/v3/files/${fileId}` +
      `?alt=media&key=${apiKey}`;

    const response = await fetch(driveUrl, {
      cache: "no-store",
    });

    // Ambil pesan error asli dari Google Drive
    if (!response.ok) {
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
