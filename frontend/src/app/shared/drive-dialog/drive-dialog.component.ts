import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { FeedDrive } from '../../core/models/feed-drive.model';
import { DriveService } from '../../core/services/drive.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-drive-dialog',
  imports: [CommonModule,  MatDialogModule,  MatIconModule],
  templateUrl: './drive-dialog.component.html',
  styleUrl: './drive-dialog.component.css'
})
export class DriveDialogComponent {
  successMessage = '';
  errorMessage = '';
  constructor(
    @Inject(MAT_DIALOG_DATA)
    public drive: FeedDrive,
    private driveService: DriveService,
    private authService: AuthService,
    private router: Router,
    private dialogRef: MatDialogRef<DriveDialogComponent>
  ) {}

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
            'Failed to join drive';

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

          this.errorMessage =
            'Failed to leave drive';

        }

      }

    });

  }

}
