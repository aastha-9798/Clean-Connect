import { FeedDrive } from './feed-drive.model';

// a drive the user joined or organised (including completed and cancelled ones)
export interface UserDrive extends FeedDrive {
  is_organizer: boolean;
  checked_in: boolean; // shown as "Attended"
  joined_at: string;
}
