export interface Session {
  id: number;
  photographer_id?: string | null;
  location: string;
  session_date?: string | null;
  whatsapp_number?: string | null;
  instagram_link?: string | null;
  price_single?: number | null;
  min_qty_discount?: number | null;
  price_discount?: number | null;
  drive_folder_id?: string | null;
  total_photos?: number | null;
  created_at?: string | null;
}

export interface PhotoMetadata {
  id: number;
  session_id: number;
  drive_file_id: string;
  file_name?: string | null;
  exif_time?: string | null;
  created_at?: string | null;
  plate_number?: string | null;
  bike_model?: string | null;
  bike_color?: string | null;
  jacket_color?: string | null;
}

export interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  webViewLink?: string;
}

export interface PhotoFilters {
  plateNumber: string;
  bikeModel: string;
  bikeColor: string;
  jacketColor: string;
  exifTimeFrom: string;
  exifTimeTo: string;
}
