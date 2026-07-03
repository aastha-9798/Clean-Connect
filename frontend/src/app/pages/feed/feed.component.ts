import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FeedService } from '../../core/services/feed.service';
import { FeedReport } from '../../core/models/feed-report.model';
import { FeedDrive } from '../../core/models/feed-drive.model';
import { DriveDialogComponent } from '../../shared/drive-dialog/drive-dialog.component';

import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ReportDialogComponent } from '../../shared/report-dialog/report-dialog.component';

@Component({
  selector: 'app-feed',
  imports: [CommonModule, DatePipe, MatDialogModule],
  templateUrl: './feed.component.html',
  styleUrl: './feed.component.css'
})
export class FeedComponent implements OnInit{
  reports: FeedReport[] = [];
  drives: FeedDrive[] = [];

  constructor(
    private feedService: FeedService,
    private dialog: MatDialog
  ){}
  ngOnInit(): void {
    this.loadFeed();

  }
  loadFeed(): void {

    this.feedService.getFeed()
      .subscribe({
        next: (response) => {
          this.reports = response.reports;
          this.drives = response.drives;
        },

        error: (error) => {
          console.error(error);
        }
      });

  }
  openReportDialog(report: FeedReport): void {

    const dialogRef = this.dialog.open(
      ReportDialogComponent,
      {
        width: '700px',
        data: report
      }
    );

    dialogRef.afterClosed()
      .subscribe((createdDrive) => {
        if (createdDrive) {
          this.loadFeed();
        }
      });
  }
  openDriveDialog(drive: FeedDrive): void {

    const dialogRef = this.dialog.open(
      DriveDialogComponent,
      {
        width: '700px',
        data: drive
      }
    );

    dialogRef.afterClosed()
      .subscribe((changed) => {

        if (changed) {

          this.loadFeed();

        }

      });

  }


}
