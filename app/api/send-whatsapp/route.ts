import { NextRequest, NextResponse } from "next/server";

function normalizePhoneNumber(value: string) {
  const cleaned = value.replace(/\D/g, "");
  if (!cleaned) return "";

  if (cleaned.startsWith("62")) return cleaned;
  if (cleaned.startsWith("0")) return `62${cleaned.slice(1)}`;
  return cleaned;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, message, photoLinks = [] } = body || {};

    if (!phone) {
      return NextResponse.json(
        {
          success: false,
          message: "Nomor WhatsApp tujuan belum dikirim.",
        },
        { status: 400 },
      );
    }

    const recipient = normalizePhoneNumber(phone);
    const finalMessage =
      message ||
      (photoLinks.length > 0
        ? `Halo, ini foto yang saya kirim:\n${photoLinks
            .map((link: string, index: number) => `${index + 1}. ${link}`)
            .join("\n")}`
        : "Halo, ini foto dari sesi yang saya kirim.");

    const redirectUrl = `https://wa.me/${recipient}?text=${encodeURIComponent(finalMessage)}`;

    return NextResponse.json({
      success: true,
      mode: "redirect",
      url: redirectUrl,
      message: "Redirect ke WhatsApp berhasil dibuat.",
    });
  } catch (error) {
    console.error("send-whatsapp route error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Terjadi kesalahan saat menyiapkan redirect WhatsApp.",
      },
      { status: 500 },
    );
  }
}
