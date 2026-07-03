export interface UserDrive {
  drive_id: string;
  description: string;
  scheduled_at: string;
  status: string;
  participant_count: number;
  latitude: number;
  longitude: number;
  image: string;

  report: {
    id: number;
    description: string;
  };

  joined_at: string;
}