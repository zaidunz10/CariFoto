import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import SessionDetailClient from "@/components/SessionDetailClient";
import { fetchSessionByIdServer } from "@/lib/supabase-server";

interface SessionPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: SessionPageProps): Promise<Metadata> {
  const { id } = await params;
  const { session } = await fetchSessionByIdServer(Number(id));

  if (!session) {
    return {
      title: "Sesi Tidak Ditemukan",
    };
  }

  return {
    title: `Foto ${session.location}`,
    description: `Cari dan unduh foto sunmori/hunting di ${session.location}${
      session.session_date ? ` (${session.session_date.slice(0, 10)})` : ""
    } di CariFoto.`,
  };
}

async function SessionLoader({ params }: SessionPageProps) {
  const { id } = await params;
  const { session, notFound: isMissing, error } = await fetchSessionByIdServer(
    Number(id),
  );

  if (isMissing) {
    notFound();
  }

  if (error || !session) {
    throw new Error(error || "Gagal memuat detail sesi.");
  }

  return <SessionDetailClient initialSession={session} />;
}

export default function SessionDetailPage({ params }: SessionPageProps) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#100E17] text-sm text-[#AAA1B8]">
          Memuat detail sesi...
        </main>
      }
    >
      <SessionLoader params={params} />
    </Suspense>
  );
}
