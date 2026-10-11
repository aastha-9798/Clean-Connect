import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule ,MatDialogRef} from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { FeedReport } from '../../core/models/feed-report.model';
import {
  ReactiveFormsModule,
  FormGroup,
  FormControl,
  Validators
} from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ImageGalleryComponent } from '../image-gallery/image-gallery.component';
import { DriveService } from '../../core/services/drive.service';
import { ReportService } from '../../core/services/report.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../confirm-dialog/confirm-dialog.component';
import { APP_TIMEZONE_OFFSET } from '../../core/constants/timezone';

@Component({
  selector: 'app-report-dialog',
  imports: [
    CommonModule,
    MatDialogModule,
    ReactiveFormsModule,
    MatIconModule,
    ImageGalleryComponent
  ],
  templateUrl: './report-dialog.component.html',
  styleUrl: './report-dialog.component.css'
})
export class ReportDialogComponent {

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public report: FeedReport,
    private driveService: DriveService,
    private reportService: ReportService,
    private authService: AuthService,
    private dialog: MatDialog,
    private dialogRef: MatDialogRef<ReportDialogComponent>
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

  // only the person who reported it sees the delete button
  get isOwner(): boolean {
    return this.authService.getCurrentUserId() === this.report.reported_by_id;
  }
  driveForm = new FormGroup({

    description: new FormControl('', [
      Validators.required
    ]),

    scheduled_at: new FormControl('', [
      Validators.required
    ])

  });
  successMessage = ''; 
  errorMessage = '';
  showDriveForm = false;
  openDriveForm(): void {
    this.showDriveForm = true;
  }
  onCreateDrive(): void {

    if (this.driveForm.invalid) {
      return;
    }

    this.driveService.createDrive({

      report_id: this.report.id,

      description:
        this.driveForm.value.description!,

      // the picker gives a time with no timezone ("2026-10-23T21:30"); read it as IST
      scheduled_at: new Date(
        this.driveForm.value.scheduled_at! + APP_TIMEZONE_OFFSET
      ).toISOString()

    })
    .subscribe({

      next: (response) => {

        console.log(response);

        this.successMessage =
          'Drive created successfully';

        this.errorMessage = '';
        this.driveForm.reset();
        this.showDriveForm = false;
      },

      error: (error) => {

        console.error(error);

        this.successMessage = '';

        this.errorMessage =
          'Failed to create drive';

      }

    });

  }
  deleteReport(): void {

    this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      data: {
        title: 'Delete this report?',
        message: 'The report and its photos will be removed permanently. This can\'t be undone.',
        confirmText: 'Delete report'
      }
    })
    .afterClosed()
    .subscribe((confirmed) => {

      if (!confirmed) {
        return;
      }

      this.reportService.deleteReport(this.report.id)
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
                : 'Failed to delete report';
          }

        });

    });

  }
  closeDialog(): void {

    this.dialogRef.close(
      this.successMessage !== ''
    );

  }
}