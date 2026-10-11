import { Component, Inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ImageGalleryComponent } from '../image-gallery/image-gallery.component';
import { Router } from '@angular/router';
import { FeedDrive } from '../../core/models/feed-drive.model';
import { DriveService } from '../../core/services/drive.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../confirm-dialog/confirm-dialog.component';
import { DriveDayPanelComponent } from '../drive-day-panel/drive-day-panel.component';

@Component({
  selector: 'app-drive-dialog',
  imports: [CommonModule,  MatDialogModule,  MatIconModule, ImageGalleryComponent, DriveDayPanelComponent],
  templateUrl: './drive-dialog.component.html',
  styleUrl: './drive-dialog.component.css'
})
export class DriveDialogComponent {
  successMessage = '';
  errorMessage = '';

  // check-in, photos and organizer tools; reloaded after joining or leaving
  @ViewChild(DriveDayPanelComponent) dayPanel?: DriveDayPanelComponent;

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public drive: FeedDrive,
    private driveService: DriveService,
    private authService: AuthService,
    private router: Router,
    private dialog: MatDialog,
    private dialogRef: MatDialogRef<DriveDialogComponent>
  ) {
    // Esc and clicks outside the dialog go through closeDialog() too,
    // so the page behind still learns that something changed and reloads
    dialogRef.disableClose = true;
    dialogRef.backdropClick().subscribe(() => this.closeDialog());
    dialogRef.keydownEvents().subscribe((event) => {
      if (event.key === 'Escape') {
        this.closeDialog();
      }
    });
  }

  // the organizer can delete the drive (but can't join or leave it)
  get isOrganizer(): boolean {
    return this.authService.getCurrentUserId() === this.drive.organizer_id;
  }

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  get statusLabel(): string {
    return { planned: 'Planned drive', completed: 'Completed', cancelled: 'Cancelled' }[this.drive.status];
  }

  get statusIcon(): string {
    return { planned: 'event_available', completed: 'task_alt', cancelled: 'event_busy' }[this.drive.status];
  }

  // something changed in the day panel (check-in, photos, completed) - reload the feed when the dialog closes
  onPanelChanged(): void {
    this.driveChanged = true;
    this.successMessage = '';
    this.errorMessage = '';
  }

  deleteDrive(): void {

    this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      data: {
        title: 'Delete this drive?',
        message: 'All participants will be removed and the report will show as open again. This can\'t be undone.',
        confirmText: 'Delete drive'
      }
    })
    .afterClosed()
    .subscribe((confirmed) => {

      if (!confirmed) {
        return;
      }

      this.driveService.deleteDrive(this.drive.drive_id)
        .subscribe({

          next: () => {
            this.dialogRef.close(true); // true makes the feed reload
          },

          error: (error) => {
            console.error(error);
            this.successMessage = '';
            this.errorMessage =
              typeof error.error?.detail === 'string'
                ? error.error.detail
                : 'Failed to delete drive';
          }

        });

    });

  }

  closeDialog(): void {

    this.dialogRef.close(
      this.driveChanged
    );

  }
  private driveChanged = false;

  joinDrive(): void {

    if (!this.authService.isLoggedIn()) {

      this.dialogRef.close(false);

      this.router.navigate(['/login']);

      return;
    }

    this.driveService.joinDrive(
      this.drive.drive_id
    )
    .subscribe({

      next: (response) => {

        console.log(response);

        this.successMessage =
          'Joined drive successfully';

        this.errorMessage = '';
        this.driveChanged = true;
        this.drive.participant_count += 1;
        this.dayPanel?.loadMyState();

      },

      error: (error) => {

        console.error(error);

        if (
          error.error?.detail ===
          'User already participated in this drive'
        ) {

          this.successMessage =
            'You are already participating in this drive';

          this.errorMessage = '';

        }
        else {

          this.errorMessage =
            typeof error.error?.detail === 'string'
              ? error.error.detail
              : 'Failed to join drive';

        }

      }

    });

  }

  leaveDrive(): void {

    if (!this.authService.isLoggedIn()) {

      this.dialogRef.close(false);

      this.router.navigate(['/login']);

      return;
    }

    this.driveService.leaveDrive(
      this.drive.drive_id
    )
    .subscribe({

      next: (response) => {

        console.log(response);

        this.successMessage =
          'Left drive successfully';

        this.errorMessage = '';
        this.driveChanged = true;
        this.drive.participant_count = Math.max(0, this.drive.participant_count - 1);
        this.dayPanel?.loadMyState();

      },

      error: (error) => {

        console.error(error);

        if (
          error.error?.detail ===
          'participation does not exist'
        ) {

          this.errorMessage =
            'You are not participating in this drive';

        }
        else if (
          error.status === 403
        ) {

          this.errorMessage =
            'As the organizer, you cannot leave your own drive.';

        }
        else {

          // e.g. "You've already checked in to this drive"
          this.errorMessage =
            typeof error.error?.detail === 'string'
              ? error.error.detail
              : 'Failed to leave drive';

        }

      }

    });

  }

}
