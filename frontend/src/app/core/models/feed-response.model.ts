import { FeedDrive } from './feed-drive.model';
import { FeedReport } from './feed-report.model';

export interface FeedResponse {
  drives: FeedDrive[];
  reports: FeedReport[];
}