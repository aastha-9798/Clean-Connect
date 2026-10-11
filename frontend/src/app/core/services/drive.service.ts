import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateDriveRequest } from '../models/create-drive-request.model';
import { MyDriveState, DriveAttendee } from '../models/drive-state.model';

@Injectable({
  providedIn: 'root'
})
export class DriveService {

  constructor(private http: HttpClient) { }

  createDrive(
    data: CreateDriveRequest
  ): Observable<any> {

    return this.http.post(
      `${environment.apiUrl}/drives/`,
      data
    );

  }
  joinDrive(driveId: string) {

    return this.http.post(
      `${environment.apiUrl}/drives/${driveId}/join`,
      {}
    );

  }
  deleteDrive(driveId: string) {

    return this.http.delete(
      `${environment.apiUrl}/drives/${driveId}`
    );

  }
  leaveDrive(driveId: string) {

    return this.http.delete(
      `${environment.apiUrl}/drives/${driveId}/leave`
    );

  }
  getMyState(driveId: string) {

    return this.http.get<MyDriveState>(
      `${environment.apiUrl}/drives/${driveId}/me`
    );

  }
  // the position is only used by the backend to check the distance; it isn't stored
  checkIn(driveId: string, position: { latitude: number; longitude: number; accuracy: number }) {

    return this.http.post<{ checked_in: boolean; joined_now: boolean }>(
      `${environment.apiUrl}/drives/${driveId}/check-in`,
      position
    );

  }
  addAfterPhotos(driveId: string, files: File[]) {

    const formData = new FormData();
    for (const file of files) {
      formData.append('images', file);
    }
    return this.http.post<{ after_images: string[]; my_photo_count: number }>(
      `${environment.apiUrl}/drives/${driveId}/photos`,
      formData
    );

  }
  completeDrive(driveId: string) {

    return this.http.post<{ message: string; completed_at: string }>(
      `${environment.apiUrl}/drives/${driveId}/complete`,
      {}
    );

  }
  getAttendees(driveId: string) {

    return this.http.get<DriveAttendee[]>(
      `${environment.apiUrl}/drives/${driveId}/attendees`
    );

  }
  removeCheckIn(driveId: string, userId: string) {

    return this.http.delete(
      `${environment.apiUrl}/drives/${driveId}/check-in/${userId}`
    );

  }
}
