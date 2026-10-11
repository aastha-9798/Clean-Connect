import { FeedDrive } from './feed-drive.model';
import { FeedReport } from './feed-report.model';

// GET /map/items - same item shapes as the feed, limited to the visible map area
export interface MapItemsResponse {
  drives: FeedDrive[];           // planned drives
  reports: FeedReport[];         // open reports
  completed_drives: FeedDrive[]; // only when "Recently cleaned" is ticked
}

export interface MapBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}
