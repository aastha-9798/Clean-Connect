export interface UserReport {
  id: number;
  image_url: string;  // cover photo (first of images)
  images: string[];   // all photos, cover first
  latitude: number;
  longitude: number;
  description: string;
  status: string;
  created_at: string;
  has_drive: boolean;  // reports with a drive can't be deleted
}