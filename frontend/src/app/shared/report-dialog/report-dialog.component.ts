import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule ,MatDialogRef} from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { FeedReport } from '../../core/models/feed-report.model';
import {
  ReactiveFormsModule,
  FormGroup,
  FormControl,
  Validators
} from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { DriveService } from '../../core/services/drive.service';

@Component({
  selector: 'app-report-dialog',
  imports: [
    CommonModule,
    MatDialogModule,
    ReactiveFormsModule,
    MatIconModule
  ],
  templateUrl: './report-dialog.component.html',
  styleUrl: './report-dialog.component.css'
})
export class ReportDialogComponent {

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public report: FeedReport,
    private driveService: DriveService,
    private dialogRef: MatDialogRef<ReportDialogComponent>
  ) {}
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

      scheduled_at: new Date(
        this.driveForm.value.scheduled_at!
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
  closeDialog(): void {

    this.dialogRef.close(
      this.successMessage !== ''
    );

  }
}