export interface FeedDrive {
  drive_id: string;
  organized_by: string;
  organizer_id: string;  // user id of the organizer (for showing "Delete")
  description: string;
  scheduled_at: string;
  participant_count: number;
  latitude: number;
  longitude: number;
  image: string;      // cover photo (first of images)
  images: string[];   // all photos of the report, cover first

  report: {
    id: number;
    description: string;
  };
}