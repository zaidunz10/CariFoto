"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import BottomNav from "@/components/BottomNav";
import ConfirmDialog from "@/components/ConfirmDialog";
import WhatsAppIcon from "@/img/whatsapp.png";
import { supabase } from "@/lib/supabase";
import type { Session } from "@/lib/types";
import {
  buildWhatsAppMessage,
  formatSessionDayDate,
  normalizeWhatsAppNumber,
} from "@/lib/whatsapp";

interface HomeClientProps {
  initialSessions: Session[];
  initialError?: string | null;
}

export default function HomeClient({
  initialSessions,
  initialError = null,
}: HomeClientProps) {
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [loadError, setLoadError] = useState<string | null>(initialError);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [isSearchTriggered, setIsSearchTriggered] = useState<boolean>(false);

  const [pendingWhatsAppUrl, setPendingWhatsAppUrl] = useState<string | null>(
    null,
  );

  const shouldShowSessions = Boolean(
    isSearchTriggered ||
      selectedLocation ||
      selectedDate ||
      sessions.length > 0 ||
      loadError,
  );

  async function refreshSessions() {
    if (!supabase) {
      setLoadError("Supabase belum dikonfigurasi.");
      return;
    }

    try {
      setIsRefreshing(true);
      setLoadError(null);
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        setLoadError(error.message);
        return;
      }

      setSessions((data || []) as Session[]);
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : "Gagal mengambil data sesi dari server.",
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  // Deduplikasi lokasi secara case-insensitive
  const availableLocations = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sessions) {
      const trimmed = s.location?.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      const existing = map.get(key);
      if (!existing || (existing === existing.toLowerCase() && trimmed !== trimmed.toLowerCase())) {
        map.set(key, trimmed);
      }
    }
    return Array.from(map.values());
  }, [sessions]);

  // Tanggal unik untuk lokasi yang dipilih, urut terbaru dulu
  const availableDatesForLocation = useMemo(() => {
    if (!selectedLocation) return [];

    const needle = selectedLocation.toLowerCase();
    const dates = sessions
      .filter((s) => s.location?.trim().toLowerCase().includes(needle))
      .map((s) => s.session_date?.substring(0, 10))
      .filter(Boolean) as string[];

    return Array.from(new Set(dates)).sort((a, b) => b.localeCompare(a));
  }, [sessions, selectedLocation]);

  // Sesi terfilter
  const visibleSessions = useMemo(() => {
    if (sessions.length === 0) return [];
    const locNeedle = selectedLocation.toLowerCase();

    return sessions.filter((s) => {
      const matchLoc =
        !selectedLocation ||
        s.location?.trim().toLowerCase().includes(locNeedle);
      const matchDate =
        !selectedDate || s.session_date?.substring(0, 10) === selectedDate;
      return matchLoc && matchDate;
    });
  }, [sessions, selectedLocation, selectedDate]);

  return (
    <main className="min-h-screen w-full bg-[#100E17] px-4 py-6 pb-28 text-white sm:px-8 lg:px-12">
      <div className="flex min-h-screen w-full flex-col">
        {/* Header Brand */}
        <header className="flex items-center justify-between border-b border-[#302A3A] pb-4">
          <div>
            <h1 className="text-2xl font-bold text-[#7B4FE0] sm:text-3xl">
              CariFoto
            </h1>
            <p className="text-xs text-[#AAA1B8] sm:text-sm">
              Temukan momen berkendaramu
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/orders"
              className="rounded-full border border-[#302A3A] bg-[#181520] px-3.5 py-1.5 text-xs font-medium text-[#AAA1B8] transition-all hover:border-[#7B4FE0]"
            >
              🛒 Pesanan
            </Link>
          </div>
        </header>

        {/* Filter Card Container */}
        <section className="my-6 rounded-2xl border border-[#302A3A] bg-[#181520] p-4 shadow-xl sm:p-6">
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Lokasi / Event */}
            <div>
              <label className="mb-2 block text-xs font-bold text-white sm:text-sm">
                📍 Pilih Lokasi / Event
              </label>
              {availableLocations.length === 0 ? (
                <p className="py-1 text-xs text-[#AAA1B8]">
                  Belum ada data lokasi sesi.
                </p>
              ) : (
                <div className="no-scrollbar flex w-full gap-2 overflow-x-auto pb-2 pt-1">
                  {availableLocations.map((loc) => {
                    const isSelected =
                      selectedLocation.toLowerCase() === loc.toLowerCase();
                    return (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => {
                          setSelectedLocation(isSelected ? "" : loc);
                          setSelectedDate("");
                          setIsSearchTriggered(true);
                        }}
                        className={`shrink-0 cursor-pointer touch-manipulation whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs transition-all sm:text-sm ${
                          isSelected
                            ? "bg-[#7B4FE0] font-bold text-white shadow-lg shadow-[#7B4FE0]/30"
                            : "border border-[#302A3A] bg-[#100E17] text-[#AAA1B8] hover:border-[#7B4FE0]"
                        }`}
                      >
                        {loc}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tanggal Hunting */}
            <div>
              <label className="mb-2 block text-xs font-bold text-white sm:text-sm">
                📅 Pilih Tanggal Hunting
              </label>
              {!selectedLocation ? (
                <p className="py-1 text-xs text-[#AAA1B8]">
                  Pilih Lokasi / Event terlebih dahulu
                </p>
              ) : availableDatesForLocation.length === 0 ? (
                <p className="py-1 text-xs text-[#AAA1B8]">
                  Belum ada riwayat tanggal untuk lokasi ini
                </p>
              ) : (
                <div className="no-scrollbar flex w-full gap-2 overflow-x-auto pb-2 pt-1">
                  {availableDatesForLocation.map((date) => {
                    const isSelected = selectedDate === date;
                    return (
                      <button
                        key={date}
                        type="button"
                        onClick={() => {
                          setSelectedDate(isSelected ? "" : date);
                          setIsSearchTriggered(true);
                        }}
                        className={`shrink-0 cursor-pointer touch-manipulation whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs transition-all sm:text-sm ${
                          isSelected
                            ? "bg-[#7B4FE0] font-bold text-white shadow-lg shadow-[#7B4FE0]/30"
                            : "border border-[#302A3A] bg-[#100E17] text-[#AAA1B8] hover:border-[#7B4FE0]"
                        }`}
                      >
                        {date}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Tombol Cari */}
          <button
            type="button"
            onClick={() => setIsSearchTriggered(true)}
            className="flex w-full cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-xl bg-[#7B4FE0] py-3 text-sm font-bold text-white shadow-lg shadow-[#7B4FE0]/25 transition-all hover:bg-[#683ec9] sm:text-base"
          >
            <span>🔍</span> Cari Folder Sesi
          </button>
        </section>

        {/* Daftar Sesi Fotografer */}
        {shouldShowSessions && (
          <section className="space-y-4 pb-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-white sm:text-base">
                Folder Sesi Fotografer
              </h2>
              {(selectedLocation || selectedDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLocation("");
                    setSelectedDate("");
                  }}
                  className="text-xs font-bold text-[#AAA1B8] hover:text-white"
                >
                  Reset Filter
                </button>
              )}
            </div>

            {loadError ? (
              <div className="rounded-2xl border border-rose-500/40 bg-[#181520] px-5 py-10 text-center">
                <p className="text-sm font-bold text-rose-200">
                  Gagal memuat daftar sesi
                </p>
                <p className="mt-1 text-xs text-[#AAA1B8]">{loadError}</p>
                <button
                  type="button"
                  onClick={refreshSessions}
                  disabled={isRefreshing}
                  className="mt-4 rounded-xl bg-[#7B4FE0] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#683ec9] disabled:opacity-60"
                >
                  {isRefreshing ? "Memuat..." : "Muat Ulang"}
                </button>
              </div>
            ) : visibleSessions.length === 0 ? (
              <div className="rounded-2xl border border-[#302A3A] bg-[#181520] py-12 text-center">
                <p className="text-sm font-bold text-white">
                  Belum ada sesi hunting
                </p>
                <p className="mt-1 text-xs text-[#AAA1B8]">
                  Coba pilih lokasi atau tanggal lainnya.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visibleSessions.map((session) => {
                  const rawIg = session.instagram_link?.replace(/^@/, "").trim();
                  const normalizedWa = normalizeWhatsAppNumber(
                    session.whatsapp_number,
                  );
                  const formattedDate = formatSessionDayDate(
                    session.session_date,
                  );
                  const waUrl = normalizedWa
                    ? `https://wa.me/${normalizedWa}?text=${encodeURIComponent(
                        buildWhatsAppMessage({
                          sessionLocation: session.location,
                          sessionDate: session.session_date,
                          instagramLink: session.instagram_link,
                          photos: [],
                        }),
                      )}`
                    : "";

                  return (
                    <div
                      key={session.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-[#302A3A] bg-[#181520] p-4 shadow-md transition-all hover:border-[#7B4FE0]"
                    >
                      <div className="flex min-w-0 items-center gap-3.5">
                        <span className="shrink-0 text-3xl">📁</span>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-bold text-white sm:text-base">
                            {session.location}
                          </h3>
                          {formattedDate && (
                            <p className="mt-0.5 truncate text-[11px] font-medium text-[#AAA1B8]">
                              📅 {formattedDate}
                            </p>
                          )}
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold">
                            {rawIg && (
                              <a
                                href={`https://instagram.com/${encodeURIComponent(rawIg)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[#7B4FE0] hover:underline"
                              >
                                @{rawIg}
                              </a>
                            )}
                            {rawIg && waUrl && (
                              <span className="text-[#AAA1B8]">•</span>
                            )}
                            {waUrl && (
                              <a
                                href={waUrl}
                                onClick={(e) => {
                                  e.preventDefault();
                                  setPendingWhatsAppUrl(waUrl);
                                }}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-[#25D366] hover:underline"
                              >
                                <Image
                                  src={WhatsAppIcon}
                                  alt="WhatsApp"
                                  className="h-4 w-4 object-contain"
                                />
                                <span>Whatsapp Fotografer</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      <Link
                        href={`/session/${session.id}`}
                        className="shrink-0 cursor-pointer touch-manipulation rounded-xl bg-[#7B4FE0]/25 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-[#7B4FE0] sm:text-sm"
                      >
                        BUKA ›
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      <BottomNav active="home" />

      <ConfirmDialog
        open={Boolean(pendingWhatsAppUrl)}
        title="Buka WhatsApp Fotografer?"
        description="Kamu akan diarahkan ke chat WhatsApp fotografer untuk sesi ini."
        confirmLabel="Lanjut ke WhatsApp"
        confirmVariant="whatsapp"
        onConfirm={() => {
          if (pendingWhatsAppUrl) {
            window.open(pendingWhatsAppUrl, "_blank", "noopener,noreferrer");
          }
        }}
        onClose={() => setPendingWhatsAppUrl(null)}
      />
    </main>
  );
}
