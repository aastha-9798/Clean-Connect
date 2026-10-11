import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { UserService } from '../../core/services/user.service';
import { ReportService } from '../../core/services/report.service';
import { DriveService } from '../../core/services/drive.service';
import { UserReport } from '../../core/models/user-report.model';
import { UserDrive } from '../../core/models/user-drive.model';
import { CommonModule, DatePipe } from '@angular/common';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/confirm-dialog/confirm-dialog.component';
import { DriveDialogComponent } from '../../shared/drive-dialog/drive-dialog.component';

@Component({
  selector: 'app-profile',
  imports: [CommonModule, DatePipe, RouterLink, MatIconModule, MatDialogModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit {
  constructor(
    private userService: UserService,
    private reportService: ReportService,
    private driveService: DriveService,
    private dialog: MatDialog
  ) {}
  reports: UserReport[] = [];
  drives: UserDrive[] = [];
  errorMessage = '';

  ngOnInit(): void {
    this.loadReports();
    this.loadDrives();
  }

  loadReports(): void {
    this.userService.getMyReports()
      .subscribe({
        next: (reports) => {
          console.log(reports);
          this.reports = reports;
        },
        error: (error) => {
          console.error(error);
        }

      });
  }

  loadDrives(): void {
    this.userService.getMyDrives()
      .subscribe({
        next: (drives) => {
          console.log(drives);
          this.drives = drives;
        },
        error: (error) => {
          console.error(error);
        }

      });
  }

  // the same drive dialog as the feed (check-in, photos, completing); cancelled drives can only be opened from here
  openDrive(drive: UserDrive): void {
    this.dialog.open(DriveDialogComponent, { width: '700px', data: drive })
      .afterClosed()
      .subscribe((changed) => {
        if (changed) {
          this.loadDrives();
          this.loadReports(); // the report's status may have changed too (e.g. resolved)
        }
      });
  }

  deleteReport(report: UserReport): void {
    this.confirm({
      title: 'Delete this report?',
      message: 'The report and its photos will be removed permanently. This can\'t be undone.',
      confirmText: 'Delete report'
    }, () => {
      this.reportService.deleteReport(report.id)
        .subscribe({
          next: () => {
            this.errorMessage = '';
            this.reports = this.reports.filter((r) => r.id !== report.id);
          },
          error: (error) => this.showError(error, 'Failed to delete report')
        });
    });
  }

  deleteDrive(drive: UserDrive): void {
    this.confirm({
      title: 'Delete this drive?',
      message: 'All participants will be removed and the report will show as open again. This can\'t be undone.',
      confirmText: 'Delete drive'
    }, () => {
      this.driveService.deleteDrive(drive.drive_id)
        .subscribe({
          next: () => {
            this.errorMessage = '';
            this.drives = this.drives.filter((d) => d.drive_id !== drive.drive_id);
            this.loadReports(); // the report may now be deletable (it no longer has a drive)
          },
          error: (error) => this.showError(error, 'Failed to delete drive')
        });
    });
  }

  private confirm(data: ConfirmDialogData, onConfirm: () => void): void {
    this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, { data })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          onConfirm();
        }
      });
  }

  private showError(error: any, fallback: string): void {
    console.error(error);
    this.errorMessage =
      typeof error.error?.detail === 'string'
        ? error.error.detail
        : fallback;
  }

}
