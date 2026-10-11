export type DriveStatus = 'planned' | 'completed' | 'cancelled';

export interface FeedDrive {
  drive_id: string;
  organized_by: string;
  organizer_id: string;  // user id of the organizer (for organizer-only actions)
  description: string;
  scheduled_at: string;
  status: DriveStatus;
  completed_at: string | null;
  participant_count: number;
  checked_in_count: number;
  latitude: number;
  longitude: number;
  image: string;          // cover photo (first of images)
  images: string[];       // the report's photos ("before"), cover first
  after_images: string[]; // photos added by checked-in attendees ("after")

  check_in_opens_at: string;   // check-in is possible between these two times
  check_in_closes_at: string;
  completion_deadline: string; // not completed by then -> cancelled automatically

  report: {
    id: number;
    description: string;
  };
}
