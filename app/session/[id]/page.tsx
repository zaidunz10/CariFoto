"use client";

import { Suspense, useState, useEffect, useRef, useMemo } from "react";
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

interface PhotoMetadata {
  id: number;
  session_id: number;
  drive_file_id: string;
  file_name?: string | null;
  exif_time?: string | null;
  plate_number?: string | null;
  bike_model?: string | null;
  bike_color?: string | null;
  jacket_color?: string | null;
}

interface PhotoFilters {
  plateNumber: string;
  bikeModel: string;
  bikeColor: string;
  jacketColor: string;
  exifTimeFrom: string;
  exifTimeTo: string;
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

function parseTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^(\d{1,2})[:.](\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function SessionDetailContent() {
  const [downloadProgress, setDownloadProgress] = useState({
    current: 0,
    total: 0,
    active: false,
    failed: 0,
  });
  const [downloadingSingleId, setDownloadingSingleId] = useState<string | null>(
    null,
  );
  const [downloadAlert, setDownloadAlert] = useState<{
    type: "loading" | "success" | "error";
    message: string;
  } | null>(null);

  const params = useParams();
  const router = useRouter();
  const sessionId = params.id;

  const [session, setSession] = useState<Session | null>(null);
  const [driveFolders, setDriveFolders] = useState<DriveItem[]>([]);
  const [drivePhotos, setDrivePhotos] = useState<DriveItem[]>([]);
  const [photoMetadata, setPhotoMetadata] = useState<PhotoMetadata[]>([]);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showSearchBanner, setShowSearchBanner] = useState(true);
  const [draftFilters, setDraftFilters] = useState<PhotoFilters>({
    plateNumber: "",
    bikeModel: "",
    bikeColor: "",
    jacketColor: "",
    exifTimeFrom: "",
    exifTimeTo: "",
  });
  const [appliedFilters, setAppliedFilters] = useState<PhotoFilters>({
    plateNumber: "",
    bikeModel: "",
    bikeColor: "",
    jacketColor: "",
    exifTimeFrom: "",
    exifTimeTo: "",
  });

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

  const uniqueFilterOptions = useMemo(() => {
    const unique = (values: (string | null | undefined)[]) => {
      const map = new Map<string, string>();
      for (const raw of values) {
        const trimmed = raw?.trim();
        if (!trimmed) continue;
        const key = trimmed.toLowerCase();
        if (!map.has(key)) map.set(key, trimmed);
      }
      return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
    };

    return {
      bikeModels: unique(photoMetadata.map((photo) => photo.bike_model)),
      bikeColors: unique(photoMetadata.map((photo) => photo.bike_color)),
      jacketColors: unique(photoMetadata.map((photo) => photo.jacket_color)),
    };
  }, [photoMetadata]);

  const activeFilterCount = Object.values(appliedFilters).filter((value) =>
    value.trim(),
  ).length;

  const displayedPhotos = useMemo(() => {
    const normalize = (value?: string | null) =>
      value?.toLowerCase().trim().replace(/\s+/g, " ") || "";
    const compact = (value?: string | null) =>
      value?.toLowerCase().replace(/\s+/g, "") || "";

    const filters = {
      plateNumber: normalize(appliedFilters.plateNumber),
      plateCompact: compact(appliedFilters.plateNumber),
      bikeModel: normalize(appliedFilters.bikeModel),
      bikeColor: normalize(appliedFilters.bikeColor),
      jacketColor: normalize(appliedFilters.jacketColor),
      fromMinutes: parseTimeToMinutes(appliedFilters.exifTimeFrom),
      toMinutes: parseTimeToMinutes(appliedFilters.exifTimeTo),
    };

    if (activeFilterCount === 0) return drivePhotos;

    const metadataByDriveId = new Map(
      photoMetadata.map((photo) => [photo.drive_file_id, photo]),
    );

    const sourceList: DriveItem[] =
      drivePhotos.length > 0
        ? drivePhotos
        : photoMetadata.map((meta) => ({
            id: meta.drive_file_id,
            name: meta.file_name || `${meta.drive_file_id}.jpg`,
            mimeType: "image/jpeg",
            webViewLink: `https://drive.google.com/file/d/${meta.drive_file_id}/view`,
          }));

    return sourceList.filter((drivePhoto) => {
      const metadata = metadataByDriveId.get(drivePhoto.id);
      if (!metadata) return false;

      const plateNumber = normalize(metadata.plate_number);
      const plateCompact = compact(metadata.plate_number);
      const bikeModel = normalize(metadata.bike_model);
      const bikeColor = normalize(metadata.bike_color);
      const jacketColor = normalize(metadata.jacket_color);
      const photoMinutes = parseTimeToMinutes(metadata.exif_time);

      const matchPlate =
        !filters.plateNumber ||
        plateNumber.includes(filters.plateNumber) ||
        plateCompact.includes(filters.plateCompact);

      const matchTimeFrom =
        filters.fromMinutes === null ||
        (photoMinutes !== null && photoMinutes >= filters.fromMinutes);

      const matchTimeTo =
        filters.toMinutes === null ||
        (photoMinutes !== null && photoMinutes <= filters.toMinutes);

      return (
        matchPlate &&
        (!filters.bikeModel || bikeModel === filters.bikeModel) &&
        (!filters.bikeColor || bikeColor === filters.bikeColor) &&
        (!filters.jacketColor || jacketColor === filters.jacketColor) &&
        matchTimeFrom &&
        matchTimeTo
      );
    });
  }, [drivePhotos, photoMetadata, appliedFilters, activeFilterCount]);

  function handleApplySearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setSelectedPhotoIds([]);
    setAppliedFilters({ ...draftFilters });
    setIsSearchOpen(false);
  }

  function handleResetFilters() {
    const empty: PhotoFilters = {
      plateNumber: "",
      bikeModel: "",
      bikeColor: "",
      jacketColor: "",
      exifTimeFrom: "",
      exifTimeTo: "",
    };
    setDraftFilters(empty);
    setAppliedFilters(empty);
    setSelectedPhotoIds([]);
  }

  async function downloadSinglePhoto(photo: DriveItem) {
    const response = await fetch(
      `/api/drive-download?id=${encodeURIComponent(photo.id)}`,
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);

      console.error("Detail download gagal:", errorData);

      throw new Error(
        `${photo.name}: ${errorData?.detail || errorData?.error || response.statusText}`,
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
    if (downloadingSingleId) return;

    const photo =
      displayedPhotos.find((item) => item.id === fileId) ||
      (selectedPhoto?.id === fileId ? selectedPhoto : null);

    if (!photo) return;

    try {
      setDownloadingSingleId(fileId);
      setDownloadAlert({
        type: "loading",
        message: `Sedang mengunduh ${photo.name || "foto HD"}... Mohon tunggu sebentar.`,
      });

      await downloadSinglePhoto(photo);

      setDownloadAlert({
        type: "success",
        message: `Berhasil mengunduh ${photo.name || "foto HD"}!`,
      });
      window.setTimeout(() => {
        setDownloadAlert((prev) => (prev?.type === "success" ? null : prev));
      }, 3000);
    } catch (error) {
      console.error(error);
      setDownloadAlert({
        type: "error",
        message: "Gagal mengunduh foto. Silakan coba kembali.",
      });
      window.setTimeout(() => {
        setDownloadAlert((prev) => (prev?.type === "error" ? null : prev));
      }, 4000);
    } finally {
      setDownloadingSingleId(null);
    }
  }

  async function handleDownloadSelectedPhotos() {
    if (!selectedPhotoIds.length || downloadProgress.active) return;

    const queue = displayedPhotos.filter((photo) =>
      selectedPhotoIds.includes(photo.id),
    );

    if (!queue.length) return;

    setDownloadProgress({
      current: 0,
      total: queue.length,
      active: true,
      failed: 0,
    });

    setDownloadAlert({
      type: "loading",
      message: `Sedang mengunduh 1 dari ${queue.length} foto... Mohon jangan tutup halaman.`,
    });

    let failed = 0;

    for (let index = 0; index < queue.length; index += 1) {
      const photo = queue[index];

      setDownloadAlert({
        type: "loading",
        message: `Sedang mengunduh ${index + 1} dari ${queue.length} foto (${photo.name})...`,
      });

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

    if (failed === 0) {
      setDownloadAlert({
        type: "success",
        message: `Selesai! ${queue.length} foto berhasil diunduh.`,
      });
    } else {
      setDownloadAlert({
        type: "error",
        message: `Selesai mengunduh, namun ${failed} dari ${queue.length} foto gagal.`,
      });
    }

    window.setTimeout(() => {
      setDownloadAlert(null);
    }, 4000);
  }

  function openWhatsAppChat(photos: DriveItem[]) {
    const whatsappNumber = normalizeWhatsAppNumber(session?.whatsapp_number);

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

  useEffect(() => {
    if (!sessionId) return;

    const client = supabase;
    if (!client) return;

    const safeClient = client;
    let isMounted = true;

    async function fetchPhotoMetadata() {
      try {
        setIsLoadingMetadata(true);
        const allRows: PhotoMetadata[] = [];
        const pageSize = 1000;

        for (let from = 0; ; from += pageSize) {
          const { data, error } = await safeClient
            .from("photos")
            .select(
              "id,session_id,drive_file_id,file_name,exif_time,plate_number,bike_model,bike_color,jacket_color",
            )
            .eq("session_id", Number(sessionId))
            .range(from, from + pageSize - 1)
            .order("id", { ascending: true });

          if (error) throw error;

          const rows = (data || []) as PhotoMetadata[];
          allRows.push(...rows);

          if (rows.length < pageSize) break;
        }

        if (isMounted) setPhotoMetadata(allRows);
      } catch (err) {
        console.error("Gagal memuat metadata foto sesi:", err);
        if (isMounted) setPhotoMetadata([]);
      } finally {
        if (isMounted) setIsLoadingMetadata(false);
      }
    }

    fetchPhotoMetadata();

    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  const hasSearchData = !isLoadingMetadata && photoMetadata.length > 0;

  return (
    <main
      className={`min-h-screen w-full bg-[#100E17] text-white px-3 sm:px-6 lg:px-8 py-3 pb-28 ${multiSelectMode ? "pt-20" : ""}`}
    >
      {/* Floating Alert Status Download (Tampil di atas modal maupun halaman utama) */}
      {downloadAlert && (
        <div className="fixed left-1/2 top-4 z-[60] w-[92%] max-w-md -translate-x-1/2">
          <div
            className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-bold shadow-2xl backdrop-blur-xl sm:text-sm ${
              downloadAlert.type === "loading"
                ? "border-[#7B4FE0] bg-[#181520]/95 text-[#D9CBFF]"
                : downloadAlert.type === "success"
                  ? "border-emerald-500/60 bg-emerald-950/95 text-emerald-200"
                  : "border-rose-500/60 bg-rose-950/95 text-rose-200"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {downloadAlert.type === "loading" && (
                <span className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#D9CBFF] border-t-transparent" />
              )}
              {downloadAlert.type === "success" && (
                <span className="shrink-0">✅</span>
              )}
              {downloadAlert.type === "error" && (
                <span className="shrink-0">⚠️</span>
              )}
              <span>{downloadAlert.message}</span>
            </div>

            {downloadAlert.type !== "loading" && (
              <button
                type="button"
                onClick={() => setDownloadAlert(null)}
                className="shrink-0 text-white/70 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

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

            {/* Tombol Dropdown Cari Foto */}
            {!multiSelectMode && hasSearchData && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsSearchOpen((prev) => !prev)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[9px] font-bold shadow-lg transition sm:text-[10px] ${
                    isSearchOpen || activeFilterCount > 0
                      ? "border-[#7B4FE0] bg-[#7B4FE0] text-white shadow-[#7B4FE0]/25"
                      : "border-[#7B4FE0]/40 bg-[#181520] text-[#D9CBFF] shadow-[#7B4FE0]/10 hover:border-[#7B4FE0] hover:text-white"
                  }`}
                >
                  <span>🔎 Cari Foto</span>
                  {activeFilterCount > 0 && (
                    <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[9px]">
                      {activeFilterCount}
                    </span>
                  )}
                  <span className="text-[8px]">{isSearchOpen ? "▲" : "▼"}</span>
                </button>
              </div>
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
                        displayedPhotos.filter((photo) =>
                          selectedPhotoIds.includes(photo.id),
                        ),
                      )
                    }
                    className="rounded-lg bg-[#25D366] px-2 py-1.5 text-[9px] font-bold text-white shadow-lg shadow-[#25D366]/30 transition hover:bg-[#1ebc5c] sm:text-[10px]"
                    disabled={
                      whatsappSending ||
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

        {/* Dropdown Panel Filter */}
        {hasSearchData && isSearchOpen && (
          <div className="border-t border-[#302A3A] bg-[#181520]/98 shadow-2xl backdrop-blur-xl">
            <form
              onSubmit={handleApplySearch}
              className="mx-auto max-w-[1800px] px-3 py-4 sm:px-6 lg:px-8"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[11px] text-[#AAA1B8]">
                  Isi satu atau beberapa kolom (opsional), lalu tekan{" "}
                  <strong className="text-white">Cari Foto</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(false)}
                  className="text-xs font-bold text-[#AAA1B8] hover:text-white"
                >
                  Tutup ✕
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <label className="text-[11px] font-bold text-[#AAA1B8]">
                  Plat / Nomor Kendaraan
                  <input
                    value={draftFilters.plateNumber}
                    onChange={(event) =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        plateNumber: event.target.value,
                      }))
                    }
                    placeholder="Contoh: D 5421"
                    className="mt-1.5 w-full rounded-lg border border-[#302A3A] bg-[#100E17] px-3 py-2 text-xs text-white outline-none placeholder:text-[#675F73] focus:border-[#7B4FE0]"
                  />
                </label>

                <label className="text-[11px] font-bold text-[#AAA1B8]">
                  Model Motor
                  <select
                    value={draftFilters.bikeModel}
                    onChange={(event) =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        bikeModel: event.target.value,
                      }))
                    }
                    className="mt-1.5 w-full rounded-lg border border-[#302A3A] bg-[#100E17] px-3 py-2 text-xs text-white outline-none focus:border-[#7B4FE0]"
                  >
                    <option value="">Semua Model Motor</option>
                    {uniqueFilterOptions.bikeModels.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-[11px] font-bold text-[#AAA1B8]">
                  Warna Motor
                  <select
                    value={draftFilters.bikeColor}
                    onChange={(event) =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        bikeColor: event.target.value,
                      }))
                    }
                    className="mt-1.5 w-full rounded-lg border border-[#302A3A] bg-[#100E17] px-3 py-2 text-xs text-white outline-none focus:border-[#7B4FE0]"
                  >
                    <option value="">Semua Warna Motor</option>
                    {uniqueFilterOptions.bikeColors.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-[11px] font-bold text-[#AAA1B8]">
                  Warna Jaket
                  <select
                    value={draftFilters.jacketColor}
                    onChange={(event) =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        jacketColor: event.target.value,
                      }))
                    }
                    className="mt-1.5 w-full rounded-lg border border-[#302A3A] bg-[#100E17] px-3 py-2 text-xs text-white outline-none focus:border-[#7B4FE0]"
                  >
                    <option value="">Semua Warna Jaket</option>
                    {uniqueFilterOptions.jacketColors.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-[11px] font-bold text-[#AAA1B8]">
                  Dari Jam EXIF
                  <input
                    type="time"
                    value={draftFilters.exifTimeFrom}
                    onChange={(event) =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        exifTimeFrom: event.target.value,
                      }))
                    }
                    className="mt-1.5 w-full rounded-lg border border-[#302A3A] bg-[#100E17] px-3 py-2 text-xs text-white outline-none focus:border-[#7B4FE0] [color-scheme:dark]"
                  />
                </label>

                <label className="text-[11px] font-bold text-[#AAA1B8]">
                  Sampai Jam EXIF
                  <input
                    type="time"
                    value={draftFilters.exifTimeTo}
                    onChange={(event) =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        exifTimeTo: event.target.value,
                      }))
                    }
                    className="mt-1.5 w-full rounded-lg border border-[#302A3A] bg-[#100E17] px-3 py-2 text-xs text-white outline-none focus:border-[#7B4FE0] [color-scheme:dark]"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="rounded-lg border border-[#302A3A] bg-[#100E17] px-4 py-2 text-xs font-bold text-[#AAA1B8] transition hover:border-[#7B4FE0] hover:text-white"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#7B4FE0] px-5 py-2 text-xs font-bold text-white shadow-lg shadow-[#7B4FE0]/30 transition hover:bg-[#683ec9]"
                >
                  🔎 Cari Foto
                </button>
              </div>
            </form>
          </div>
        )}
      </header>

      {/* Alert / Banner Info jika sesi punya data metadata motor */}
      {hasSearchData && showSearchBanner && activeFilterCount === 0 && !isSearchOpen && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[#7B4FE0]/40 bg-[#7B4FE0]/10 px-3.5 py-2.5 text-xs shadow-md">
          <div className="flex items-center gap-2 text-[#D9CBFF]">
            <span className="text-base">🏍️</span>
            <span>
              <strong className="text-white">Kamu bisa cari motor kamu di sini!</strong>{" "}
              <span className="hidden sm:inline text-[#AAA1B8]">
                Cari cepat berdasarkan plat nomor, jenis motor, warna, atau jam lewat.
              </span>
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="rounded-lg bg-[#7B4FE0] px-3 py-1.5 text-[11px] font-bold text-white shadow-md shadow-[#7B4FE0]/25 transition hover:bg-[#683ec9]"
            >
              Cari Sekarang
            </button>
            <button
              type="button"
              onClick={() => setShowSearchBanner(false)}
              className="p-1 text-[#AAA1B8] hover:text-white"
              aria-label="Tutup pemberitahuan"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Bar Info Ringkas saat filter sedang aktif */}
      {hasSearchData && activeFilterCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#7B4FE0]/40 bg-[#181520] px-3.5 py-2.5 text-xs">
          <span className="font-bold text-[#D9CBFF]">
            {drivePhotos.length > 0
              ? `Menampilkan ${displayedPhotos.length} dari ${drivePhotos.length} foto di folder ini`
              : `Ditemukan ${displayedPhotos.length} foto di seluruh sesi ini`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="font-bold text-[#7B4FE0] hover:underline"
            >
              Ubah filter
            </button>
            <span className="text-[#302A3A]">|</span>
            <button
              type="button"
              onClick={handleResetFilters}
              className="font-bold text-[#FFB4A2] hover:underline"
            >
              Reset
            </button>
          </div>
        </div>
      )}

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

      {/* Subfolders Jam EXIF (Tetap muncul di atas meskipun sedang filter) */}
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
                className="bg-[#181520] border border-[#302A3A] rounded-xl p-3.5 flex items-center justify-between cursor-pointer hover:border-[#7B4FE0] transition-all shadow-md min-w-45"
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
      ) : driveFolders.length === 0 && displayedPhotos.length === 0 ? (
        <div className="text-center py-16 bg-[#181520] border border-[#302A3A] rounded-2xl p-6">
          <span className="text-4xl mb-3 block">📂</span>
          <p className="text-sm font-bold text-white mb-1">
            Folder Masih Kosong
          </p>
          <p className="text-xs text-[#AAA1B8]">
            Belum ada file foto di folder ini.
          </p>
        </div>
      ) : activeFilterCount > 0 && displayedPhotos.length === 0 ? (
        <div className="text-center py-16 bg-[#181520] border border-[#302A3A] rounded-2xl p-6">
          <span className="text-4xl mb-3 block">🔎</span>
          <p className="text-sm font-bold text-white mb-1">
            Foto tidak ditemukan
          </p>
          <p className="text-xs text-[#AAA1B8]">
            Coba kurangi filter atau kosongkan salah satu isian pencarian.
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
          {displayedPhotos.map((photo) => {
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
                {normalizeWhatsAppNumber(session?.whatsapp_number) ? (
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
                  disabled={downloadingSingleId === selectedPhoto.id}
                  className="block w-full rounded-xl bg-[#7B4FE0] py-3 text-sm font-bold text-white shadow-lg shadow-[#7B4FE0]/30 transition-all hover:bg-[#683ec9] sm:text-base disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {downloadingSingleId === selectedPhoto.id
                    ? "Sedang mengunduh... ⏳"
                    : "Unduh Foto HD ⬇️"}
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