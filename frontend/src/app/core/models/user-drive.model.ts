export interface UserDrive {
  drive_id: string;
  description: string;
  scheduled_at: string;
  status: string;
  is_organizer: boolean;
  participant_count: number;
  latitude: number;
  longitude: number;
  image: string;      // cover photo (first of images)
  images: string[];   // all photos of the report, cover first

  report: {
    id: number;
    description: string;
  };

  joined_at: string;
}