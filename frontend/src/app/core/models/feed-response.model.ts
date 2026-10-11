import { FeedDrive } from './feed-drive.model';
import { FeedReport } from './feed-report.model';

export interface FeedResponse {
  drives: FeedDrive[];           // planned drives
  completed_drives: FeedDrive[]; // most recently completed first
  reports: FeedReport[];         // open reports (no planned or completed drive)
}
