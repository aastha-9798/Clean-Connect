import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateDriveRequest } from '../models/create-drive-request.model';

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
  leaveDrive(driveId: string) {

    return this.http.delete(
      `${environment.apiUrl}/drives/${driveId}/leave`
    );

  }
}
