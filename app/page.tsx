"use client";

import Image from "next/image";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { buildWhatsAppMessage, normalizeWhatsAppNumber } from "@/lib/whatsapp";
import Link from "next/link";
import WhatsAppIcon from "../img/whatsapp.png";

interface Session {
  id: number;
  photographer_id?: string;
  location: string;
  session_date?: string;
  whatsapp_number?: string;
  instagram_link?: string;
  price_single?: number;
  min_qty_discount?: number;
  price_discount?: number;
  drive_folder_id?: string;
  is_published?: boolean;
  created_at?: string;
}

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [isSearchTriggered, setIsSearchTriggered] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const shouldShowSessions = Boolean(
    isSearchTriggered ||
    selectedLocation ||
    selectedDate ||
    sessions.length > 0,
  );

  // Fetch sessions dari Supabase
  useEffect(() => {
    let isMounted = true;

    async function fetchSessions() {
      try {
        setIsLoading(true);

        if (!supabase) {
          console.error("Supabase belum dikonfigurasi.");
          return;
        }

        const { data, error } = await supabase
          .from("sessions")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Supabase Error:", error.message);
        } else if (data && isMounted) {
          setSessions(data as Session[]);
        }
      } catch (err) {
        console.error("Gagal mengambil data dari Supabase:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchSessions();

    const safetyTimer = setTimeout(() => {
      if (isMounted) setIsLoading(false);
    }, 3000);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, []);

  // Filter Lokasi Unik
  const availableLocations = useMemo(() => {
    const locs = sessions
      .map((s) => s.location?.trim())
      .filter(Boolean) as string[];

    if (locs.length > 0) {
      return Array.from(new Set(locs));
    }

    return ["Ciwidey", "Lembang", "Sunmori Lembang", "Tikungan Mesra"];
  }, [sessions]);

  // Filter Tanggal Unik berdasarkan Lokasi yang dipilih
  const availableDatesForLocation = useMemo(() => {
    if (!selectedLocation) return [];
    const dates = sessions
      .filter((s) =>
        s.location?.toLowerCase().includes(selectedLocation.toLowerCase()),
      )
      .map((s) => s.session_date?.substring(0, 10))
      .filter(Boolean) as string[];

    if (dates.length > 0) {
      return Array.from(new Set(dates));
    }

    return ["2026-11-09", "2026-11-10", "2026-11-11"];
  }, [sessions, selectedLocation]);

  // Sesi terfilter
  const visibleSessions = useMemo(() => {
    if (sessions.length === 0) return [];
    return sessions.filter((s) => {
      const matchLoc =
        !selectedLocation ||
        s.location?.toLowerCase().includes(selectedLocation.toLowerCase());
      const matchDate =
        !selectedDate || s.session_date?.substring(0, 10) === selectedDate;
      return matchLoc && matchDate;
    });
  }, [sessions, selectedLocation, selectedDate]);

  return (
    <main className="min-h-screen bg-[#100E17] text-white px-4 sm:px-8 lg:px-12 py-6 w-full pb-28">
      <div className="flex min-h-screen w-full flex-col">
        {/* Header Brand */}
        <header className="flex justify-between items-center pb-4 border-b border-[#302A3A]">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#7B4FE0]">
              CariFoto
            </h1>
            <p className="text-xs sm:text-sm text-[#AAA1B8]">
              Temukan momen berkendaramu
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/orders"
              className="text-xs bg-[#181520] border border-[#302A3A] hover:border-[#7B4FE0] px-3.5 py-1.5 rounded-full text-[#AAA1B8] font-medium transition-all"
            >
              🛒 Pesanan
            </Link>
          </div>
        </header>

        {/* Filter Card Container */}
        <section className="bg-[#181520] border border-[#302A3A] rounded-2xl p-4 sm:p-6 my-6 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Lokasi / Event */}
            <div>
              <label className="text-xs sm:text-sm font-bold text-white mb-2 block">
                📍 Pilih Lokasi / Event
              </label>
              <div className="flex gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar w-full">
                {isLoading && availableLocations.length === 0 ? (
                  <p className="text-xs text-[#AAA1B8]">Memuat lokasi...</p>
                ) : (
                  availableLocations.map((loc) => {
                    const isSelected = selectedLocation === loc;
                    return (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => {
                          setSelectedLocation(isSelected ? "" : loc);
                          setSelectedDate("");
                          setIsSearchTriggered(true);
                        }}
                        className={`text-xs sm:text-sm px-3.5 py-1.5 rounded-full whitespace-nowrap shrink-0 transition-all touch-manipulation cursor-pointer ${
                          isSelected
                            ? "bg-[#7B4FE0] text-white font-bold shadow-lg shadow-[#7B4FE0]/30"
                            : "bg-[#100E17] text-[#AAA1B8] border border-[#302A3A]"
                        }`}
                      >
                        {loc}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Tanggal Hunting */}
            <div>
              <label className="text-xs sm:text-sm font-bold text-white mb-2 block">
                📅 Pilih Tanggal Hunting
              </label>
              {!selectedLocation ? (
                <p className="text-xs text-[#AAA1B8] py-1">
                  Pilih Lokasi / Event terlebih dahulu
                </p>
              ) : availableDatesForLocation.length === 0 ? (
                <p className="text-xs text-[#AAA1B8] py-1">
                  Belum ada riwayat tanggal untuk lokasi ini
                </p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar w-full">
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
                        className={`text-xs sm:text-sm px-3.5 py-1.5 rounded-full whitespace-nowrap shrink-0 transition-all touch-manipulation cursor-pointer ${
                          isSelected
                            ? "bg-[#7B4FE0] text-white font-bold shadow-lg shadow-[#7B4FE0]/30"
                            : "bg-[#100E17] text-[#AAA1B8] border border-[#302A3A] hover:border-[#7B4FE0]"
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
            className="w-full bg-[#7B4FE0] hover:bg-[#683ec9] text-white font-bold text-sm sm:text-base py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#7B4FE0]/25 touch-manipulation cursor-pointer"
          >
            <span>🔍</span> Cari Folder Sesi
          </button>
        </section>

        {/* Daftar Sesi Fotografer */}
        {shouldShowSessions && (
          <section className="space-y-4 pb-2">
            <h2 className="text-sm sm:text-base font-bold text-white">
              Folder Sesi Fotografer
            </h2>

            {isLoading && visibleSessions.length === 0 ? (
              <div className="text-center py-12 text-xs text-[#AAA1B8]">
                Memuat data Supabase...
              </div>
            ) : visibleSessions.length === 0 ? (
              <div className="text-center py-12 bg-[#181520] border border-[#302A3A] rounded-2xl">
                <p className="text-sm font-bold text-white">
                  Belum ada sesi hunting
                </p>
                <p className="text-xs text-[#AAA1B8] mt-1">
                  Coba pilih lokasi atau tanggal lainnya.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {visibleSessions.map((session) => {
                  const rawIg = session.instagram_link?.replace("@", "").trim();
                  const rawWa = session.whatsapp_number
                    ?.replace("+", "")
                    .replace(/\s+/g, "");

                  return (
                    <div
                      key={session.id}
                      className="bg-[#181520] border border-[#302A3A] rounded-2xl p-4 flex items-center justify-between hover:border-[#7B4FE0] transition-all shadow-md"
                    >
                      <div className="flex items-center gap-3.5">
                        <span className="text-3xl">📁</span>
                        <div>
                          <h3 className="text-sm sm:text-base font-bold text-white">
                            {session.location}
                          </h3>
                          <div className="flex items-center gap-2 text-xs font-bold mt-1">
                            {rawIg && (
                              <a
                                href={`https://instagram.com/${rawIg}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[#7B4FE0] hover:underline"
                              >
                                @{rawIg}
                              </a>
                            )}
                            {rawIg && rawWa && (
                              <span className="text-[#AAA1B8]">•</span>
                            )}
                            {rawWa && (
                              <a
                                href={`https://wa.me/${normalizeWhatsAppNumber(rawWa)}?text=${encodeURIComponent(
                                  buildWhatsAppMessage({
                                    sessionLocation: session.location,
                                    sessionDate: session.session_date,
                                    instagramLink: session.instagram_link,
                                    photos: [],
                                  }),
                                )}`}
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
                        className="bg-[#7B4FE0]/25 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-xl hover:bg-[#7B4FE0] transition-all cursor-pointer touch-manipulation"
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

      {/* BOTTOM NAVBAR RIDER */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#23143D]/95 backdrop-blur-md border-t border-[#302A3A] py-2 px-4">
        <div className="max-w-md mx-auto flex justify-around items-center">
          <Link
            href="/"
            className="flex flex-col items-center gap-1 text-xs font-bold text-white bg-[#7B4FE0] px-4 py-1.5 rounded-xl shadow-lg shadow-[#7B4FE0]/30"
          >
            <span className="text-base">🏠</span>
            <span>Cari Foto</span>
          </Link>

          <Link
            href="/orders"
            className="flex flex-col items-center gap-1 text-xs font-bold text-[#9E8DBE] hover:text-white px-4 py-1.5 rounded-xl transition-all"
          >
            <span className="text-base">🛒</span>
            <span>Pesanan</span>
          </Link>

          <Link
            href="/profile"
            className="flex flex-col items-center gap-1 text-xs font-bold text-[#9E8DBE] hover:text-white px-4 py-1.5 rounded-xl transition-all"
          >
            <span className="text-base">👤</span>
            <span>Profil</span>
          </Link>
        </div>
      </nav>
    </main>
  );
}