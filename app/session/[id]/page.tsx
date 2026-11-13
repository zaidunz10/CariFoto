"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { buildWhatsAppMessage, normalizeWhatsAppNumber } from "@/lib/whatsapp";

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  webViewLink?: string;
}

interface Session {
  id: number;
  location: string;
  session_date?: string;
  whatsapp_number?: string;
  instagram_link?: string;
  price_single?: number;
  drive_folder_id?: string;
}

type AuthUser = {
  id: string;
  email?: string | null;
};

const DRIVE_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY ||
  "AIzaSyCr0nZXdPz9hV9TCBpzEdSxOmXovqGCMCg";

function extractFolderId(urlOrId?: string): string | null {
  if (!urlOrId) return null;
  if (urlOrId.includes("/folders/")) {
    return urlOrId.split("/folders/")[1]?.split("?")[0]?.split("/")[0] || null;
  }
  return urlOrId;
}

function getPhotoImageUrl(photo: DriveItem, size: number = 800): string {
  if (photo.thumbnailLink) {
    return photo.thumbnailLink.replace(/=s\d+$/, `=s${size}`);
  }
  return `https://drive.google.com/thumbnail?id=${photo.id}&sz=w${size}`;
}

function SessionDetailContent() {
  const [downloadProgress, setDownloadProgress] = useState({
    current: 0,
    total: 0,
    active: false,
    failed: 0,
  });
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id;

  const [session, setSession] = useState<Session | null>(null);
  const [driveFolders, setDriveFolders] = useState<DriveItem[]>([]);
  const [drivePhotos, setDrivePhotos] = useState<DriveItem[]>([]);
  const [folderStack, setFolderStack] = useState<
    { id: string; name: string }[]
  >([]);

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const gridColumns = 2;
  const [selectedPhoto, setSelectedPhoto] = useState<DriveItem | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState<boolean>(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [whatsappSending, setWhatsappSending] = useState<boolean>(false);
  const selectionTimerRef = useRef<number | null>(null);
  const longPressTriggeredPhotoIdRef = useRef<string | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    let isMounted = true;

    client.auth.getUser().then(({ data }) => {
      if (isMounted) setCurrentUser(data.user ?? null);
    });

    const { data: authListener } = client.auth.onAuthStateChange(
      (_event, session) => {
        if (isMounted) setCurrentUser(session?.user || null);
      },
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    const client = supabase;
    if (!client) return;

    const safeClient = client;

    async function fetchSession() {
      try {
        setIsLoading(true);
        const { data, error } = await safeClient
          .from("sessions")
          .select("*")
          .eq("id", Number(sessionId))
          .single();

        if (error) throw error;
        setSession(data);

        const rootFolderId = extractFolderId(data?.drive_folder_id);
        if (rootFolderId) {
          loadDriveFolderContent(rootFolderId);
        } else {
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Gagal memuat sesi:", err);
        setIsLoading(false);
      }
    }

    fetchSession();
  }, [sessionId]);

  async function loadDriveFolderContent(folderId: string) {
    try {
      setIsLoading(true);
      const query = encodeURIComponent(
        `'${folderId}' in parents and trashed=false`,
      );
      const fields = encodeURIComponent(
        "files(id,name,mimeType,thumbnailLink,webViewLink)",
      );
      const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&key=${DRIVE_API_KEY}&pageSize=1000`;

      const res = await fetch(url);
      const json = await res.json();

      const files: DriveItem[] = json.files || [];

      const subfolders = files
        .filter((f) => f.mimeType === "application/vnd.google-apps.folder")
        .sort((a, b) => a.name.localeCompare(b.name));

      const images = files
        .filter((f) => f.mimeType.startsWith("image/"))
        .sort((a, b) => a.name.localeCompare(b.name));

      setDriveFolders(subfolders);
      setDrivePhotos(images);
    } catch (err) {
      console.error("Gagal membaca Google Drive API:", err);
    } finally {
      setIsLoading(false);
    }
  }
 
async function downloadSinglePhoto(photo: DriveItem) {
  const response = await fetch(
    `/api/drive-download?id=${encodeURIComponent(photo.id)}`
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);

    console.error("Detail download gagal:", errorData);

    throw new Error(
      `${photo.name}: ${errorData?.detail || errorData?.error || response.statusText}`
    );
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = photo.name || "photo.jpg";

  document.body.appendChild(link);
  link.click();
  link.remove();

  await new Promise((resolve) => setTimeout(resolve, 1500));
  URL.revokeObjectURL(blobUrl);
}


  async function handleDownloadPhoto(fileId: string) {
    if (!currentUser) {
      alert("🔒 Harap login Google terlebih dahulu!");
      router.push("/profile");
      return;
    }

    const photo = drivePhotos.find((item) => item.id === fileId);

    if (!photo) return;

    try {
      await downloadSinglePhoto(photo);
    } catch (error) {
      console.error(error);
      alert("Gagal mengunduh foto. Silakan coba kembali.");
    }
  }

  async function handleDownloadSelectedPhotos() {
    if (!selectedPhotoIds.length || downloadProgress.active) return;

    if (!currentUser) {
      alert("🔒 Harap login Google terlebih dahulu!");
      router.push("/profile");
      return;
    }

    const queue = drivePhotos.filter((photo) =>
      selectedPhotoIds.includes(photo.id),
    );

    if (!queue.length) return;

    setDownloadProgress({
      current: 0,
      total: queue.length,
      active: true,
      failed: 0,
    });

    let failed = 0;

    for (let index = 0; index < queue.length; index += 1) {
      const photo = queue[index];

      try {
        await downloadSinglePhoto(photo);
        setDownloadProgress((prev) => ({
          ...prev,
          current: index + 1,
        }));
      } catch (error) {
        console.error(error);
        failed += 1;
        setDownloadProgress((prev) => ({
          ...prev,
          failed,
          current: index + 1,
        }));
      }
    }

    setDownloadProgress((prev) => ({
      ...prev,
      active: false,
      current: prev.total,
    }));
  }

  function openWhatsAppChat(photos: DriveItem[]) {
    const whatsappNumber = normalizeWhatsAppNumber(session?.whatsapp_number);

    if (!currentUser) {
      alert("🔒 Harap login untuk mengirim ke WhatsApp.");
      router.push("/profile");
      return;
    }

    if (!whatsappNumber) {
      alert("Nomor WhatsApp fotografer belum tersedia.");
      return;
    }

    if (!photos.length) {
      return;
    }

    setWhatsappSending(true);

    const currentSubfolder = folderStack[folderStack.length - 1]?.name || "";
    const message = buildWhatsAppMessage({
      sessionLocation: session?.location,
      sessionDate: session?.session_date,
      instagramLink: session?.instagram_link,
      currentSubfolder,
      photos: photos.map((photo) => ({
        id: photo.id,
        webViewLink: photo.webViewLink,
        name: photo.name,
      })),
    });

    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    const confirmed = window.confirm("Yakin ingin lanjut ke WhatsApp fotografer?");
    if (!confirmed) {
      setWhatsappSending(false);
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");

    window.setTimeout(() => {
      setWhatsappSending(false);
    }, 700);
  }

  function clearSelectionTimer() {
    if (selectionTimerRef.current) {
      window.clearTimeout(selectionTimerRef.current);
      selectionTimerRef.current = null;
    }
  }

  function togglePhotoSelection(photo: DriveItem) {
    setMultiSelectMode(true);
    setSelectedPhotoIds((prev) => {
      if (prev.includes(photo.id)) {
        return prev.filter((id) => id !== photo.id);
      }
      return [...prev, photo.id];
    });
  }

  function handlePhotoPressStart(photo: DriveItem) {
    clearSelectionTimer();
    longPressTriggeredPhotoIdRef.current = null;
    selectionTimerRef.current = window.setTimeout(() => {
      longPressTriggeredPhotoIdRef.current = photo.id;
      togglePhotoSelection(photo);
    }, 800);
  }

  function handlePhotoPressEnd() {
    clearSelectionTimer();
  }

  function handleOpenFolder(folder: DriveItem) {
    setFolderStack((prev) => [...prev, { id: folder.id, name: folder.name }]);
    loadDriveFolderContent(folder.id);
  }

  function handleBackFolder() {
    if (folderStack.length === 0) {
      router.push("/");
    } else {
      const newStack = [...folderStack];
      newStack.pop();
      setFolderStack(newStack);

      const targetFolderId =
        newStack.length > 0
          ? newStack[newStack.length - 1].id
          : extractFolderId(session?.drive_folder_id);

      if (targetFolderId) {
        loadDriveFolderContent(targetFolderId);
      }
    }
  }

  return (
    <main
      className={`min-h-screen w-full bg-[#100E17] text-white px-3 sm:px-6 lg:px-8 py-3 pb-28 ${multiSelectMode ? "pt-20" : ""}`}
    >
      {/* Top Bar Navigation Full Width */}
      <header
        className={
          multiSelectMode
            ? "fixed left-0 right-0 top-0 z-50 border-b border-[#302A3A] bg-[#100E17]/95 shadow-[0_8px_24px_rgba(0,0,0,0.22)] backdrop-blur-xl"
            : "sticky top-0 z-40 mb-4 border-b border-[#302A3A] bg-[#100E17]/95 shadow-[0_8px_24px_rgba(0,0,0,0.22)] backdrop-blur-xl"
        }
      >
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <button
              onClick={handleBackFolder}
              className="flex items-center gap-1 text-sm font-bold text-[#7B4FE0] transition hover:opacity-90 sm:text-base"
            >
              ‹ Kembali
            </button>

            {!multiSelectMode && (
              <button
                type="button"
                onClick={() => {
                  setMultiSelectMode(true);
                  setSelectedPhotoIds([]);
                }}
                className="rounded-lg border border-[#7B4FE0]/40 bg-[#181520] px-2 py-1.5 text-[9px] font-bold text-[#D9CBFF] shadow-lg shadow-[#7B4FE0]/10 transition hover:border-[#7B4FE0] hover:text-white sm:text-[10px]"
              >
                Pilih Banyak
              </button>
            )}
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 overflow-hidden text-center text-xs font-bold text-[#AAA1B8] sm:text-sm">
            <span className="shrink-0 text-[#7B4FE0]">📁</span>
            <span className="shrink-0">Sesi</span>
            <span className="hidden truncate text-white sm:inline">
              / {session?.location}
            </span>
            {folderStack.map((f) => (
              <span key={f.id} className="truncate text-[#7B4FE0]">
                / {f.name}
              </span>
            ))}
          </div>

          {multiSelectMode && (
            <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
              <span className="rounded-full border border-[#7B4FE0]/40 bg-[#7B4FE0]/10 px-2 py-1 text-[9px] font-bold text-[#D9CBFF] sm:text-[10px]">
                {selectedPhotoIds.length || 0} dipilih
              </span>

              {selectedPhotoIds.length > 0 && (
                <>
                  <button
                    onClick={() =>
                      openWhatsAppChat(
                        drivePhotos.filter((photo) =>
                          selectedPhotoIds.includes(photo.id),
                        ),
                      )
                    }
                    className="rounded-lg bg-[#25D366] px-2 py-1.5 text-[9px] font-bold text-white shadow-lg shadow-[#25D366]/30 transition hover:bg-[#1ebc5c] sm:text-[10px]"
                    disabled={
                      whatsappSending ||
                      !currentUser ||
                      !normalizeWhatsAppNumber(session?.whatsapp_number)
                    }
                  >
                    {whatsappSending ? "Mengirim..." : "Kirim WA"}
                  </button>

                  <button
                    onClick={handleDownloadSelectedPhotos}
                    className="rounded-lg bg-[#7B4FE0] px-2 py-1.5 text-[9px] font-bold text-white shadow-lg shadow-[#7B4FE0]/30 transition hover:bg-[#683ec9] sm:text-[10px]"
                    disabled={downloadProgress.active}
                  >
                    {downloadProgress.active
                      ? `${downloadProgress.current}/${downloadProgress.total}`
                      : `Download`}
                  </button>
                </>
              )}

              <button
                onClick={() => {
                  setMultiSelectMode(false);
                  setSelectedPhotoIds([]);
                }}
                className="rounded-lg border border-[#302A3A] bg-[#181520] px-2 py-1.5 text-[9px] font-bold text-[#AAA1B8] transition hover:border-[#7B4FE0] hover:text-white sm:text-[10px]"
              >
                Batal
              </button>
            </div>
          )}
        </div>
      </header>

      {downloadProgress.total > 0 && (
        <div className="mb-4 rounded-xl border border-[#302A3A] bg-[#181520] p-3">
          <div className="mb-2 flex items-center justify-between gap-2 text-[11px] sm:text-xs">
            <span className="font-bold text-[#D9CBFF]">
              {downloadProgress.active
                ? "Sedang mengunduh foto..."
                : "Proses download selesai"}
            </span>
            <span className="font-bold text-white">
              {downloadProgress.current}/{downloadProgress.total}
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-[#100E17]">
            <div
              className="h-full rounded-full bg-[#7B4FE0] transition-all duration-300"
              style={{
                width: `${
                  downloadProgress.total > 0
                    ? (downloadProgress.current / downloadProgress.total) * 100
                    : 0
                }%`,
              }}
            />
          </div>

          {downloadProgress.failed > 0 && (
            <div className="mt-2 text-[10px] font-medium text-[#FFB4A2]">
              {downloadProgress.failed} foto gagal diunduh.
            </div>
          )}
        </div>
      )}

      {/* Subfolders Jam EXIF (Presisi Single Line, Anti-Wrap Kebawah) */}
      {driveFolders.length > 0 && (
        <section className="mb-6 space-y-2">
          <h2 className="text-xs sm:text-sm font-bold text-[#AAA1B8]">
            PILIH SUB-FOLDER JAM EXIF:
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {driveFolders.map((folder) => (
              <div
                key={folder.id}
                onClick={() => handleOpenFolder(folder)}
                className="bg-[#181520] border border-[#302A3A] rounded-xl p-3.5 flex items-center justify-between cursor-pointer hover:border-[#7B4FE0] transition-all shadow-md min-w-[180px]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xl shrink-0">📁</span>
                  <span className="text-xs sm:text-sm font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis">
                    {folder.name}
                  </span>
                </div>
                <span className="text-[#7B4FE0] text-xs font-bold shrink-0 ml-2">
                  BUKA ›
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Grid Foto Full Desktop Edge-to-Edge */}
      {isLoading ? (
        <div className="text-center py-16 text-xs text-[#AAA1B8]">
          Memuat isi folder Google Drive...
        </div>
      ) : driveFolders.length === 0 && drivePhotos.length === 0 ? (
        <div className="text-center py-16 bg-[#181520] border border-[#302A3A] rounded-2xl p-6">
          <span className="text-4xl mb-3 block">📂</span>
          <p className="text-sm font-bold text-white mb-1">
            Folder Masih Kosong
          </p>
          <p className="text-xs text-[#AAA1B8]">
            Belum ada file foto di folder ini.
          </p>
        </div>
      ) : (
        <div
          className={`grid gap-3.5 ${
            gridColumns === 2
              ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8"
              : "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10"
          }`}
        >
          {drivePhotos.map((photo) => {
            const isSelected = selectedPhotoIds.includes(photo.id);

            return (
              <div
                key={photo.id}
                onPointerDown={() => handlePhotoPressStart(photo)}
                onPointerUp={() => handlePhotoPressEnd()}
                onPointerLeave={() => handlePhotoPressEnd()}
                onPointerCancel={() => handlePhotoPressEnd()}
                onMouseDown={() => handlePhotoPressStart(photo)}
                onMouseUp={() => handlePhotoPressEnd()}
                onTouchStart={() => handlePhotoPressStart(photo)}
                onTouchEnd={() => handlePhotoPressEnd()}
                onTouchCancel={() => handlePhotoPressEnd()}
                onClick={() => {
                  if (longPressTriggeredPhotoIdRef.current === photo.id) {
                    longPressTriggeredPhotoIdRef.current = null;
                    return;
                  }

                  if (multiSelectMode) {
                    togglePhotoSelection(photo);
                    return;
                  }

                  setSelectedPhoto(photo);
                }}
                className={`relative overflow-hidden rounded-xl border bg-[#181520] shadow-md transition-all cursor-pointer ${
                  isSelected
                    ? "border-[#7B4FE0] ring-2 ring-[#7B4FE0]/40"
                    : "border-[#302A3A] hover:border-[#7B4FE0]"
                }`}
              >
                <div className="relative aspect-square w-full bg-[#0F172A] p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getPhotoImageUrl(photo, 800)}
                    alt={photo.name || "Foto"}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-105"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = `https://drive.google.com/thumbnail?id=${photo.id}&sz=w800`;
                    }}
                  />
                </div>

                {isSelected && (
                  <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#7B4FE0] text-xs font-bold text-white shadow-lg shadow-[#7B4FE0]/30">
                    ✓
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Full Screen Photo Viewer Modal */}
      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 z-50 overflow-y-auto bg-black/95 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="mx-auto flex min-h-full max-w-xl flex-col justify-center gap-3 py-2"
          >
            <div className="flex w-full items-center justify-between gap-3 text-white">
              <span className="truncate pr-3 text-xs font-bold sm:text-sm">
                {selectedPhoto.name}
              </span>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/5 text-xl font-bold text-white transition hover:text-[#7B4FE0]"
                aria-label="Tutup modal foto"
              >
                ✕
              </button>
            </div>

            <div className="flex w-full items-center justify-center overflow-hidden rounded-xl bg-[#0F172A]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getPhotoImageUrl(selectedPhoto, 1600)}
                alt={selectedPhoto.name}
                referrerPolicy="no-referrer"
                className="max-h-[72vh] w-full object-contain"
                onError={(e) => {
                  e.currentTarget.src = `https://drive.google.com/thumbnail?id=${selectedPhoto.id}&sz=w1600`;
                }}
              />
            </div>

            <div className="w-full rounded-2xl border border-[#302A3A] bg-[#181520] p-4 text-center shadow-2xl">
              <p className="mb-1 text-xs font-bold text-white sm:text-sm">
                {selectedPhoto.name}
              </p>
              <p className="mb-3 text-[11px] text-[#AAA1B8] sm:text-xs">
                Format Foto HD Asli dari Google Drive
              </p>

              <div className="space-y-2">
                {currentUser && normalizeWhatsAppNumber(session?.whatsapp_number) ? (
                  <button
                    onClick={() => openWhatsAppChat([selectedPhoto])}
                    className="block w-full rounded-xl bg-[#25D366] py-3 text-sm font-bold text-white shadow-lg shadow-[#25D366]/30 transition-all hover:bg-[#1ebc5c] sm:text-base disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={whatsappSending}
                  >
                    {whatsappSending ? "Mengirim foto..." : "Kirim ke WhatsApp 💬"}
                  </button>
                ) : null}

                <button
                  onClick={() => handleDownloadPhoto(selectedPhoto.id)}
                  className="block w-full rounded-xl bg-[#7B4FE0] py-3 text-sm font-bold text-white shadow-lg shadow-[#7B4FE0]/30 transition-all hover:bg-[#683ec9] sm:text-base"
                >
                  Unduh Foto HD ⬇️
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function SessionDetailPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#100E17] text-white flex items-center justify-center">
          Memuat detail sesi...
        </main>
      }
    >
      <SessionDetailContent />
    </Suspense>
  );
}
