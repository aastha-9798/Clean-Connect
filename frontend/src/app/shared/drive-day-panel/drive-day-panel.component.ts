import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { FeedDrive } from '../../core/models/feed-drive.model';
import { MyDriveState, DriveAttendee } from '../../core/models/drive-state.model';
import { DriveService } from '../../core/services/drive.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../confirm-dialog/confirm-dialog.component';

const MAX_PHOTOS_PER_PERSON = 2;           // same limits as the backend
const MAX_DRIVE_PHOTOS = 10;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;    // 5 MB
const LOCATE_FOR_MS = 8000;                // how long to collect location readings at most
const GOOD_ENOUGH_ACCURACY_M = 30;         // stop early once a reading is this precise

// The part of the drive dialog for the day of the drive (logged-in users only):
// checking in by location, adding "after" photos, and the organizer's tools
// (marking the drive completed, seeing and correcting check-ins).
// It updates the drive object it is given and emits (changed) so the feed can reload.
@Component({
  selector: 'app-drive-day-panel',
  imports: [CommonModule, MatIconModule],
  templateUrl: './drive-day-panel.component.html',
  styleUrl: './drive-day-panel.component.css'
})
export class DriveDayPanelComponent implements OnInit {
  @Input({ required: true }) drive!: FeedDrive;
  @Output() changed = new EventEmitter<void>();

  readonly maxPhotosPerPerson = MAX_PHOTOS_PER_PERSON;
  readonly maxDrivePhotos = MAX_DRIVE_PHOTOS;

  me: MyDriveState | null = null;
  attendees: DriveAttendee[] | null = null;
  showAttendees = false;

  busy = false; // a request is running (disables the buttons)
  locating = false; // reading the device's location for check-in
  successMessage = '';
  errorMessage = '';

  constructor(
    private driveService: DriveService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadMyState();
  }

  loadMyState(): void {
    this.driveService.getMyState(this.drive.drive_id)
      .subscribe({
        next: (state) => this.me = state,
        error: (error) => console.error(error)
      });
  }

  // ---- times (all compared with "now" in the browser) ----

  private time(iso: string): number {
    return new Date(iso).getTime();
  }

  get checkInNotOpenYet(): boolean {
    return Date.now() < this.time(this.drive.check_in_opens_at);
  }

  get checkInClosed(): boolean {
    return Date.now() > this.time(this.drive.check_in_closes_at);
  }

  get hasStarted(): boolean {
    return Date.now() >= this.time(this.drive.scheduled_at);
  }

  get beforeDeadline(): boolean {
    return Date.now() <= this.time(this.drive.completion_deadline);
  }

  // ---- what the user can do ----

  get canCheckIn(): boolean {
    return this.drive.status === 'planned' && !!this.me && !this.me.checked_in
      && !this.checkInNotOpenYet && !this.checkInClosed;
  }

  get photosLeftForMe(): number {
    if (!this.me) {
      return 0;
    }
    return Math.max(0, Math.min(
      MAX_PHOTOS_PER_PERSON - this.me.my_photo_count,
      MAX_DRIVE_PHOTOS - this.drive.after_images.length
    ));
  }

  get photosOpen(): boolean {
    return this.drive.status !== 'cancelled' && this.beforeDeadline;
  }

  get canComplete(): boolean {
    return this.drive.status === 'planned' && this.hasStarted && this.drive.after_images.length > 0;
  }

  // ---- actions ----

  checkIn(): void {
    if (!navigator.geolocation) {
      this.showError('Your browser can\'t share its location, so check-in isn\'t possible here.');
      return;
    }
    this.busy = true;
    this.locating = true;
    this.clearMessages();
    this.getBestPosition().then(
      (coords) => {
        this.locating = false;
        this.driveService.checkIn(this.drive.drive_id, {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy
        })
        .subscribe({
          next: (result) => {
            this.busy = false;
            this.successMessage = result.joined_now
              ? 'You\'re checked in and have been added to this drive. Thanks for showing up!'
              : 'You\'re checked in. Thanks for showing up!';
            if (this.me) {
              this.me.checked_in = true;
              this.me.is_participant = true;
            }
            this.drive.checked_in_count += 1;
            if (result.joined_now) {
              this.drive.participant_count += 1;
            }
            this.changed.emit();
          },
          error: (error) => this.showError(error, 'Check-in failed. Please try again.')
        });
      },
      (geoError: GeolocationPositionError | null) => {
        this.locating = false;
        this.showError(geoError?.code === GeolocationPositionError.PERMISSION_DENIED
          ? 'Allow location access in your browser to check in.'
          : 'Couldn\'t get your location. Move outdoors and try again.');
      }
    );
  }

  // The first location fix is often rough (especially on phones, before GPS locks on),
  // so readings are collected for a few seconds and the most precise one is used.
  private getBestPosition(): Promise<{ latitude: number; longitude: number; accuracy: number }> {
    return new Promise((resolve, reject) => {
      let best: { latitude: number; longitude: number; accuracy: number } | null = null;
      let lastError: GeolocationPositionError | null = null;
      let watchId = 0;
      const finish = () => {
        navigator.geolocation.clearWatch(watchId);
        clearTimeout(timer);
        best ? resolve(best) : reject(lastError);
      };
      const timer = setTimeout(finish, LOCATE_FOR_MS);
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          if (!best || accuracy < best.accuracy) {
            best = { latitude, longitude, accuracy };
          }
          if (accuracy <= GOOD_ENOUGH_ACCURACY_M) {
            finish(); // precise enough, no need to wait longer
          }
        },
        (error) => {
          lastError = error;
          if (error.code === error.PERMISSION_DENIED) {
            finish();
          }
        },
        { enableHighAccuracy: true, maximumAge: 0 }
      );
    });
  }

  onPhotosSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = ''; // so picking the same file again still fires (change)
    if (files.length === 0) {
      return;
    }
    this.clearMessages();
    if (files.length > this.photosLeftForMe) {
      this.showError(`You can add ${this.photosLeftForMe} more photo${this.photosLeftForMe === 1 ? '' : 's'}.`);
      return;
    }
    const tooBig = files.find((file) => file.size > MAX_PHOTO_SIZE);
    if (tooBig) {
      this.showError(`"${tooBig.name}" is larger than 5 MB.`);
      return;
    }
    this.busy = true;
    this.driveService.addAfterPhotos(this.drive.drive_id, files)
      .subscribe({
        next: (result) => {
          this.busy = false;
          this.drive.after_images = result.after_images;
          if (this.me) {
            this.me.my_photo_count = result.my_photo_count;
          }
          this.successMessage = files.length === 1 ? 'Photo added.' : 'Photos added.';
          this.changed.emit();
        },
        error: (error) => this.showError(error, 'Failed to add photos.')
      });
  }

  completeDrive(): void {
    this.confirm({
      title: 'Mark this drive as completed?',
      message: 'The spot will be shown as cleaned up in the feed. This can\'t be undone.',
      confirmText: 'Mark completed'
    }, () => {
      this.busy = true;
      this.clearMessages();
      this.driveService.completeDrive(this.drive.drive_id)
        .subscribe({
          next: (result) => {
            this.busy = false;
            this.drive.status = 'completed';
            this.drive.completed_at = result.completed_at;
            this.successMessage = 'Drive completed. Great work, everyone!';
            this.changed.emit();
          },
          error: (error) => this.showError(error, 'Failed to complete the drive.')
        });
    });
  }

  toggleAttendees(): void {
    this.showAttendees = !this.showAttendees;
    if (this.showAttendees) {
      this.loadAttendees();
    }
  }

  loadAttendees(): void {
    this.driveService.getAttendees(this.drive.drive_id)
      .subscribe({
        next: (attendees) => this.attendees = attendees,
        error: (error) => this.showError(error, 'Failed to load attendees.')
      });
  }

  removeCheckIn(attendee: DriveAttendee): void {
    this.confirm({
      title: `Remove ${attendee.username}'s check-in?`,
      message: 'Use this if the check-in looks wrong. Their "after" photos will be removed too.',
      confirmText: 'Remove check-in'
    }, () => {
      this.busy = true;
      this.clearMessages();
      this.driveService.removeCheckIn(this.drive.drive_id, attendee.user_id)
        .subscribe({
          next: () => {
            this.busy = false;
            this.drive.checked_in_count = Math.max(0, this.drive.checked_in_count - 1);
            this.successMessage = `${attendee.username}'s check-in was removed.`;
            this.loadAttendees();
            this.changed.emit(); // their photos are gone too; the feed reload shows the new list
          },
          error: (error) => this.showError(error, 'Failed to remove the check-in.')
        });
    });
  }

  // ---- helpers ----

  private confirm(data: ConfirmDialogData, onConfirm: () => void): void {
    this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, { data })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          onConfirm();
        }
      });
  }

  private clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
  }

  // shows the backend's reason when it gives one (e.g. "You seem to be about 450 m away...")
  private showError(error: any, fallback?: string): void {
    if (typeof error !== 'string') {
      console.error(error);
    }
    this.busy = false;
    this.successMessage = '';
    this.errorMessage = typeof error === 'string'
      ? error
      : typeof error?.error?.detail === 'string'
        ? error.error.detail
        : (fallback ?? 'Something went wrong. Please try again.');
  }
}
