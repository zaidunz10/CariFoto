"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  extractFolderId,
  getPhotoImageUrl,
  getPlateMatchScore,
  matchesPlateQuery,
  parseTimeToMinutes,
} from "@/lib/drive";
import { supabase } from "@/lib/supabase";
import type {
  DriveItem,
  PhotoFilters,
  PhotoMetadata,
  Session,
} from "@/lib/types";
import { buildWhatsAppMessage, normalizeWhatsAppNumber } from "@/lib/whatsapp";

const EMPTY_FILTERS: PhotoFilters = {
  plateNumber: "",
  bikeModel: "",
  bikeColor: "",
  jacketColor: "",
  exifTimeFrom: "",
  exifTimeTo: "",
};

async function fetchDriveFolderItems(folderId: string): Promise<{
  folders: DriveItem[];
  photos: DriveItem[];
  error: string | null;
}> {
  try {
    const res = await fetch(
      `/api/drive-files?folderId=${encodeURIComponent(folderId)}`,
      { cache: "no-store" },
    );
    const json = (await res.json().catch(() => ({}))) as {
      folders?: DriveItem[];
      photos?: DriveItem[];
      error?: string;
    };

    if (!res.ok) {
      return {
        folders: [],
        photos: [],
        error: json.error || "Gagal membaca folder Google Drive.",
      };
    }

    return {
      folders: json.folders || [],
      photos: json.photos || [],
      error: null,
    };
  } catch (err) {
    console.error("Gagal membaca Google Drive API:", err);
    return {
      folders: [],
      photos: [],
      error: "Terjadi gangguan jaringan saat memuat Google Drive.",
    };
  }
}

interface SessionDetailClientProps {
  initialSession: Session;
}

export default function SessionDetailClient({
  initialSession,
}: SessionDetailClientProps) {
  const router = useRouter();
  const session = initialSession;

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

  const initialRootFolderId = useMemo(
    () => extractFolderId(initialSession.drive_folder_id),
    [initialSession.drive_folder_id],
  );

  const [driveFolders, setDriveFolders] = useState<DriveItem[]>([]);
  const [drivePhotos, setDrivePhotos] = useState<DriveItem[]>([]);
  const [driveError, setDriveError] = useState<string | null>(() =>
    initialRootFolderId
      ? null
      : "Link/ID folder Google Drive pada sesi ini tidak valid.",
  );
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(
    initialRootFolderId,
  );
  const [photoMetadata, setPhotoMetadata] = useState<PhotoMetadata[]>([]);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState<boolean>(() =>
    Boolean(supabase),
  );

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showSearchBanner, setShowSearchBanner] = useState(true);
  const [draftFilters, setDraftFilters] = useState<PhotoFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<PhotoFilters>(EMPTY_FILTERS);

  const [folderStack, setFolderStack] = useState<
    { id: string; name: string }[]
  >([]);

  const [isLoading, setIsLoading] = useState<boolean>(() =>
    Boolean(initialRootFolderId),
  );
  const [selectedPhoto, setSelectedPhoto] = useState<DriveItem | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState<boolean>(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [whatsappSending, setWhatsappSending] = useState<boolean>(false);

  const [dialogState, setDialogState] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    confirmVariant?: "primary" | "whatsapp" | "danger";
    hideCancel?: boolean;
    pendingUrl?: string;
  }>({
    open: false,
    title: "",
    description: "",
  });

  const selectionTimerRef = useRef<number | null>(null);
  const longPressTriggeredPhotoIdRef = useRef<string | null>(null);
  const swipeStartXRef = useRef<number | null>(null);

  const loadDriveFolderContent = useCallback(async (folderId: string) => {
    setSelectedPhotoIds([]);
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setCurrentFolderId(folderId);
    setIsLoading(true);
    setDriveError(null);

    const result = await fetchDriveFolderItems(folderId);
    setDriveFolders(result.folders);
    setDrivePhotos(result.photos);
    setDriveError(result.error);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!initialRootFolderId) return;

    let isMounted = true;

    fetchDriveFolderItems(initialRootFolderId).then((result) => {
      if (!isMounted) return;
      setDriveFolders(result.folders);
      setDrivePhotos(result.photos);
      setDriveError(result.error);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [initialRootFolderId]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    let isMounted = true;

    async function fetchPhotoMetadata() {
      try {
        const allRows: PhotoMetadata[] = [];
        const pageSize = 1000;

        for (let from = 0; ; from += pageSize) {
          const { data, error } = await client!
            .from("photos")
            .select(
              "id,session_id,drive_file_id,file_name,exif_time,plate_number,bike_model,bike_color,jacket_color",
            )
            .eq("session_id", session.id)
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
  }, [session.id]);

  const metadataByDriveId = useMemo(
    () => new Map(photoMetadata.map((photo) => [photo.drive_file_id, photo])),
    [photoMetadata],
  );

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

    const filters = {
      plateNumber: appliedFilters.plateNumber.trim(),
      bikeModel: normalize(appliedFilters.bikeModel),
      bikeColor: normalize(appliedFilters.bikeColor),
      jacketColor: normalize(appliedFilters.jacketColor),
      fromMinutes: parseTimeToMinutes(appliedFilters.exifTimeFrom),
      toMinutes: parseTimeToMinutes(appliedFilters.exifTimeTo),
    };

    if (activeFilterCount === 0) return drivePhotos;

    const sourceList: DriveItem[] =
      drivePhotos.length > 0
        ? drivePhotos
        : photoMetadata.map((meta) => ({
            id: meta.drive_file_id,
            name: meta.file_name || `${meta.drive_file_id}.jpg`,
            mimeType: "image/jpeg",
            webViewLink: `https://drive.google.com/file/d/${meta.drive_file_id}/view`,
          }));

    const filtered = sourceList.filter((drivePhoto) => {
      const metadata = metadataByDriveId.get(drivePhoto.id);
      if (!metadata) return false;

      const bikeModel = normalize(metadata.bike_model);
      const bikeColor = normalize(metadata.bike_color);
      const jacketColor = normalize(metadata.jacket_color);
      const photoMinutes = parseTimeToMinutes(metadata.exif_time);

      const matchPlate =
        !filters.plateNumber ||
        matchesPlateQuery(metadata.plate_number, filters.plateNumber);

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

    if (!filters.plateNumber) return filtered;

    return [...filtered].sort((a, b) => {
      const scoreA = getPlateMatchScore(
        metadataByDriveId.get(a.id)?.plate_number,
        filters.plateNumber,
      );
      const scoreB = getPlateMatchScore(
        metadataByDriveId.get(b.id)?.plate_number,
        filters.plateNumber,
      );
      return scoreA - scoreB;
    });
  }, [
    drivePhotos,
    photoMetadata,
    metadataByDriveId,
    appliedFilters,
    activeFilterCount,
  ]);

  const selectedPhotoIndex = useMemo(() => {
    if (!selectedPhoto) return -1;
    return displayedPhotos.findIndex((item) => item.id === selectedPhoto.id);
  }, [selectedPhoto, displayedPhotos]);

  const selectedPhotoMetadata = useMemo(() => {
    if (!selectedPhoto) return null;
    return metadataByDriveId.get(selectedPhoto.id) ?? null;
  }, [selectedPhoto, metadataByDriveId]);

  const goToPreviousPhoto = useCallback(() => {
    if (selectedPhotoIndex <= 0) return;
    setSelectedPhoto(displayedPhotos[selectedPhotoIndex - 1]);
  }, [selectedPhotoIndex, displayedPhotos]);

  const goToNextPhoto = useCallback(() => {
    if (
      selectedPhotoIndex < 0 ||
      selectedPhotoIndex >= displayedPhotos.length - 1
    ) {
      return;
    }
    setSelectedPhoto(displayedPhotos[selectedPhotoIndex + 1]);
  }, [selectedPhotoIndex, displayedPhotos]);

  useEffect(() => {
    if (!selectedPhoto) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedPhoto(null);
      } else if (event.key === "ArrowLeft") {
        goToPreviousPhoto();
      } else if (event.key === "ArrowRight") {
        goToNextPhoto();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPhoto, goToPreviousPhoto, goToNextPhoto]);

  function handleApplySearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setSelectedPhotoIds([]);
    setAppliedFilters({ ...draftFilters });
    setIsSearchOpen(false);
  }

  function handleResetFilters() {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setSelectedPhotoIds([]);
  }

  async function downloadSinglePhoto(photo: DriveItem) {
    const filename = photo.name || "photo.jpg";
    const response = await fetch(
      `/api/drive-download?id=${encodeURIComponent(photo.id)}&name=${encodeURIComponent(filename)}`,
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error("Detail download gagal:", errorData);

      throw new Error(
        `${filename}: ${errorData?.detail || errorData?.error || response.statusText}`,
      );
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;

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
    const whatsappNumber = normalizeWhatsAppNumber(session.whatsapp_number);

    if (!whatsappNumber) {
      setDialogState({
        open: true,
        title: "Nomor WhatsApp Belum Tersedia",
        description: "Fotografer sesi ini belum mencantumkan nomor WhatsApp.",
        confirmLabel: "Tutup",
        hideCancel: true,
      });
      return;
    }

    if (!photos.length) return;

    const currentSubfolder = folderStack[folderStack.length - 1]?.name || "";
    const message = buildWhatsAppMessage({
      sessionLocation: session.location,
      sessionDate: session.session_date,
      instagramLink: session.instagram_link,
      currentSubfolder,
      photos: photos.map((photo) => ({
        id: photo.id,
        webViewLink: photo.webViewLink,
        name: photo.name,
      })),
    });

    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    setDialogState({
      open: true,
      title: "Lanjut ke WhatsApp Fotografer?",
      description: `Akan membuka WhatsApp untuk memesan ${photos.length} foto terpilih.`,
      confirmLabel: "Buka WhatsApp",
      confirmVariant: "whatsapp",
      pendingUrl: url,
    });
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

  function toggleSelectAll() {
    if (displayedPhotos.length === 0) return;

    const allIds = displayedPhotos.map((photo) => photo.id);
    const allSelected =
      allIds.length > 0 && allIds.every((id) => selectedPhotoIds.includes(id));

    if (allSelected) {
      setSelectedPhotoIds([]);
    } else {
      setSelectedPhotoIds(allIds);
    }
  }

  function handlePhotoPointerDown(
    event: React.PointerEvent<HTMLDivElement>,
    photo: DriveItem,
  ) {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    clearSelectionTimer();
    longPressTriggeredPhotoIdRef.current = null;
    selectionTimerRef.current = window.setTimeout(() => {
      longPressTriggeredPhotoIdRef.current = photo.id;
      togglePhotoSelection(photo);
    }, 800);
  }

  function handlePhotoPointerEnd() {
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
          : extractFolderId(session.drive_folder_id);

      if (targetFolderId) {
        loadDriveFolderContent(targetFolderId);
      }
    }
  }

  const hasSearchData = !isLoadingMetadata && photoMetadata.length > 0;
  const isAllSelected =
    displayedPhotos.length > 0 &&
    displayedPhotos.every((photo) => selectedPhotoIds.includes(photo.id));

  return (
    <main
      className={`min-h-screen w-full bg-[#100E17] px-3 py-3 pb-28 text-white sm:px-6 lg:px-8 ${multiSelectMode ? "pt-20" : ""}`}
    >
      {/* Floating Alert Status Download */}
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

      {/* Top Bar Navigation */}
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
              type="button"
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
              / {session.location}
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
                {selectedPhotoIds.length} dipilih
              </span>

              {displayedPhotos.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="rounded-lg border border-[#7B4FE0]/40 bg-[#181520] px-2 py-1.5 text-[9px] font-bold text-[#D9CBFF] transition hover:border-[#7B4FE0] hover:text-white sm:text-[10px]"
                >
                  {isAllSelected ? "Batal Semua" : "Pilih Semua"}
                </button>
              )}

              {selectedPhotoIds.length > 0 && (
                <>
                  <button
                    type="button"
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
                      !normalizeWhatsAppNumber(session.whatsapp_number)
                    }
                  >
                    {whatsappSending ? "Mengirim..." : "Kirim WA"}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadSelectedPhotos}
                    className="rounded-lg bg-[#7B4FE0] px-2 py-1.5 text-[9px] font-bold text-white shadow-lg shadow-[#7B4FE0]/30 transition hover:bg-[#683ec9] sm:text-[10px]"
                    disabled={downloadProgress.active}
                  >
                    {downloadProgress.active
                      ? `${downloadProgress.current}/${downloadProgress.total}`
                      : "Download"}
                  </button>
                </>
              )}

              <button
                type="button"
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
                    onChange={(event) => {
                      const plateNumber = event.target.value;
                      setDraftFilters((prev) => ({
                        ...prev,
                        plateNumber,
                      }));
                      setAppliedFilters((prev) => ({
                        ...prev,
                        plateNumber,
                      }));
                      setSelectedPhotoIds([]);
                    }}
                    placeholder="Contoh: D 5421, 437, atau D 437"
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

      {/* Banner Info jika sesi punya metadata motor */}
      {hasSearchData &&
        showSearchBanner &&
        activeFilterCount === 0 &&
        !isSearchOpen && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[#7B4FE0]/40 bg-[#7B4FE0]/10 px-3.5 py-2.5 text-xs shadow-md">
            <div className="flex items-center gap-2 text-[#D9CBFF]">
              <span className="text-base">🏍️</span>
              <span>
                <strong className="text-white">
                  Kamu bisa cari motor kamu di sini!
                </strong>{" "}
                <span className="hidden text-[#AAA1B8] sm:inline">
                  Cari cepat berdasarkan plat nomor, jenis motor, warna, atau
                  jam lewat.
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

      {/* Bar Info Ringkas saat filter aktif */}
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

      {/* Subfolders Jam EXIF */}
      {driveFolders.length > 0 && (
        <section className="mb-6 space-y-2">
          <h2 className="text-xs font-bold text-[#AAA1B8] sm:text-sm">
            PILIH SUB-FOLDER JAM EXIF:
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {driveFolders.map((folder) => (
              <div
                key={folder.id}
                onClick={() => handleOpenFolder(folder)}
                className="flex min-w-45 cursor-pointer items-center justify-between rounded-xl border border-[#302A3A] bg-[#181520] p-3.5 shadow-md transition-all hover:border-[#7B4FE0]"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="shrink-0 text-xl">📁</span>
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-bold text-white sm:text-sm">
                    {folder.name}
                  </span>
                </div>
                <span className="ml-2 shrink-0 text-xs font-bold text-[#7B4FE0]">
                  BUKA ›
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Grid Foto / Status Loading / Error */}
      {isLoading ? (
        <div className="py-16 text-center text-xs text-[#AAA1B8]">
          Memuat isi folder Google Drive...
        </div>
      ) : driveError ? (
        <div className="rounded-2xl border border-rose-500/40 bg-[#181520] p-6 text-center">
          <span className="mb-3 block text-4xl">⚠️</span>
          <p className="mb-1 text-sm font-bold text-rose-200">
            Gagal Memuat Folder Google Drive
          </p>
          <p className="mx-auto max-w-md text-xs text-[#AAA1B8]">{driveError}</p>
          {currentFolderId && (
            <button
              type="button"
              onClick={() => loadDriveFolderContent(currentFolderId)}
              className="mt-4 rounded-xl bg-[#7B4FE0] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#683ec9]"
            >
              Muat Ulang Folder
            </button>
          )}
        </div>
      ) : driveFolders.length === 0 && displayedPhotos.length === 0 && activeFilterCount === 0 ? (
        <div className="rounded-2xl border border-[#302A3A] bg-[#181520] p-6 py-16 text-center">
          <span className="mb-3 block text-4xl">📂</span>
          <p className="mb-1 text-sm font-bold text-white">
            Folder Masih Kosong
          </p>
          <p className="text-xs text-[#AAA1B8]">
            Belum ada file foto di folder ini.
          </p>
        </div>
      ) : activeFilterCount > 0 && displayedPhotos.length === 0 ? (
        <div className="rounded-2xl border border-[#302A3A] bg-[#181520] p-6 py-16 text-center">
          <span className="mb-3 block text-4xl">🔎</span>
          <p className="mb-1 text-sm font-bold text-white">
            Foto tidak ditemukan
          </p>
          <p className="text-xs text-[#AAA1B8]">
            Coba kurangi filter atau kosongkan salah satu isian pencarian.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {displayedPhotos.map((photo) => {
            const isSelected = selectedPhotoIds.includes(photo.id);
            const matchedPlate = appliedFilters.plateNumber.trim()
              ? metadataByDriveId.get(photo.id)?.plate_number
              : null;

            return (
              <div
                key={photo.id}
                onPointerDown={(event) => handlePhotoPointerDown(event, photo)}
                onPointerUp={handlePhotoPointerEnd}
                onPointerLeave={handlePhotoPointerEnd}
                onPointerCancel={handlePhotoPointerEnd}
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
                className={`group relative cursor-pointer overflow-hidden rounded-xl border bg-[#181520] shadow-md transition-all ${
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

                {matchedPlate && (
                  <div className="pointer-events-none absolute bottom-1.5 left-1.5 max-w-[calc(100%-0.75rem)] truncate rounded-md border border-white/15 bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-[#D9CBFF] backdrop-blur-sm">
                    {matchedPlate}
                  </div>
                )}

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

      {/* Full Screen Photo Viewer Modal + Detail Kendaraan & Navigasi Prev/Next */}
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
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-xs font-bold sm:text-sm">
                  {selectedPhoto.name}
                </span>
                {selectedPhotoIndex >= 0 && displayedPhotos.length > 0 && (
                  <span className="shrink-0 rounded-full border border-[#302A3A] bg-[#181520] px-2 py-0.5 text-[10px] font-bold text-[#AAA1B8]">
                    {selectedPhotoIndex + 1} / {displayedPhotos.length}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 text-xl font-bold text-white transition hover:text-[#7B4FE0]"
                aria-label="Tutup modal foto"
              >
                ✕
              </button>
            </div>

            <div
              className="relative flex w-full items-center justify-center overflow-hidden rounded-xl bg-[#0F172A]"
              onTouchStart={(event) => {
                swipeStartXRef.current = event.touches[0]?.clientX ?? null;
              }}
              onTouchEnd={(event) => {
                const startX = swipeStartXRef.current;
                swipeStartXRef.current = null;
                if (startX === null) return;
                const endX = event.changedTouches[0]?.clientX;
                if (typeof endX !== "number") return;
                const diff = endX - startX;
                if (diff > 50) {
                  goToPreviousPhoto();
                } else if (diff < -50) {
                  goToNextPhoto();
                }
              }}
            >
              {selectedPhotoIndex > 0 && (
                <button
                  type="button"
                  onClick={goToPreviousPhoto}
                  aria-label="Foto sebelumnya"
                  className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/60 text-xl font-bold text-white backdrop-blur-sm transition hover:border-[#7B4FE0] hover:bg-[#7B4FE0]"
                >
                  ‹
                </button>
              )}

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getPhotoImageUrl(selectedPhoto, 1200)}
                alt={selectedPhoto.name}
                referrerPolicy="no-referrer"
                className="max-h-[65vh] w-full object-contain"
                onError={(e) => {
                  e.currentTarget.src = `https://drive.google.com/thumbnail?id=${selectedPhoto.id}&sz=w1200`;
                }}
              />

              {selectedPhotoIndex >= 0 &&
                selectedPhotoIndex < displayedPhotos.length - 1 && (
                  <button
                    type="button"
                    onClick={goToNextPhoto}
                    aria-label="Foto berikutnya"
                    className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/60 text-xl font-bold text-white backdrop-blur-sm transition hover:border-[#7B4FE0] hover:bg-[#7B4FE0]"
                  >
                    ›
                  </button>
                )}
            </div>

            {/* Detail Kendaraan, Plat Nomor, Jaket & EXIF */}
            <div className="w-full rounded-2xl border border-[#302A3A] bg-[#181520] p-4 shadow-2xl">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-white sm:text-sm">
                  Detail Foto &amp; Kendaraan
                </p>
                {selectedPhotoMetadata?.exif_time && (
                  <span className="rounded-full border border-[#7B4FE0]/40 bg-[#7B4FE0]/15 px-2.5 py-0.5 text-[10px] font-bold text-[#D9CBFF]">
                    ⏰ EXIF {selectedPhotoMetadata.exif_time}
                  </span>
                )}
              </div>

              {isLoadingMetadata && !selectedPhotoMetadata ? (
                <p className="mb-3 text-xs text-[#AAA1B8]">
                  Memuat detail motor, plat nomor, dan jaket...
                </p>
              ) : (
                <div className="mb-4 grid grid-cols-2 gap-2.5 text-left">
                  <div className="rounded-xl border border-[#302A3A] bg-[#100E17] p-2.5">
                    <span className="block text-[10px] font-medium text-[#AAA1B8]">
                      🪪 Plat Nomor
                    </span>
                    <span className="mt-0.5 block text-xs font-bold text-white sm:text-sm">
                      {selectedPhotoMetadata?.plate_number || "Belum terdeteksi"}
                    </span>
                  </div>

                  <div className="rounded-xl border border-[#302A3A] bg-[#100E17] p-2.5">
                    <span className="block text-[10px] font-medium text-[#AAA1B8]">
                      🏍️ Motor / Kendaraan
                    </span>
                    <span className="mt-0.5 block text-xs font-bold text-white sm:text-sm">
                      {selectedPhotoMetadata?.bike_model || "-"}
                    </span>
                  </div>

                  <div className="rounded-xl border border-[#302A3A] bg-[#100E17] p-2.5">
                    <span className="block text-[10px] font-medium text-[#AAA1B8]">
                      🎨 Warna Motor
                    </span>
                    <span className="mt-0.5 block text-xs font-bold text-white sm:text-sm">
                      {selectedPhotoMetadata?.bike_color || "-"}
                    </span>
                  </div>

                  <div className="rounded-xl border border-[#302A3A] bg-[#100E17] p-2.5">
                    <span className="block text-[10px] font-medium text-[#AAA1B8]">
                      🧥 Baju / Jaket
                    </span>
                    <span className="mt-0.5 block text-xs font-bold text-white sm:text-sm">
                      {selectedPhotoMetadata?.jacket_color || "-"}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {normalizeWhatsAppNumber(session.whatsapp_number) ? (
                  <button
                    type="button"
                    onClick={() => openWhatsAppChat([selectedPhoto])}
                    className="block w-full rounded-xl bg-[#25D366] py-3 text-sm font-bold text-white shadow-lg shadow-[#25D366]/30 transition-all hover:bg-[#1ebc5c] disabled:cursor-not-allowed disabled:opacity-70 sm:text-base"
                    disabled={whatsappSending}
                  >
                    {whatsappSending
                      ? "Mengirim foto..."
                      : "Kirim ke WhatsApp 💬"}
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => handleDownloadPhoto(selectedPhoto.id)}
                  disabled={downloadingSingleId === selectedPhoto.id}
                  className="block w-full rounded-xl bg-[#7B4FE0] py-3 text-sm font-bold text-white shadow-lg shadow-[#7B4FE0]/30 transition-all hover:bg-[#683ec9] disabled:cursor-not-allowed disabled:opacity-70 sm:text-base"
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

      <ConfirmDialog
        open={dialogState.open}
        title={dialogState.title}
        description={dialogState.description}
        confirmLabel={dialogState.confirmLabel}
        confirmVariant={dialogState.confirmVariant}
        hideCancel={dialogState.hideCancel}
        onConfirm={() => {
          if (dialogState.pendingUrl) {
            setWhatsappSending(true);
            window.open(dialogState.pendingUrl, "_blank", "noopener,noreferrer");
            window.setTimeout(() => {
              setWhatsappSending(false);
            }, 700);
          }
        }}
        onClose={() =>
          setDialogState((prev) => ({
            ...prev,
            open: false,
            pendingUrl: undefined,
          }))
        }
      />
    </main>
  );
}
