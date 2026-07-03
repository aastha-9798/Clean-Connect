export interface FeedDrive {
  drive_id: string;
  organized_by: string;
  description: string;
  scheduled_at: string;
  participant_count: number;
  latitude: number;
  longitude: number;
  image: string;

  report: {
    id: number;
    description: string;
  };
}