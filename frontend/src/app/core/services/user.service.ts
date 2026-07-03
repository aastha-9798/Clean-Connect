import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserReport } from '../models/user-report.model';
import { UserDrive } from '../models/user-drive.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  constructor(
    private http: HttpClient
  ) { }

  getMyReports(): Observable<UserReport[]> {
    return this.http.get<UserReport[]>(
      `${environment.apiUrl}/user/me/reports`
    );
  }
  getMyDrives(): Observable<UserDrive[]>{
    return this.http.get<UserDrive[]>(
      `${environment.apiUrl}/user/me/drives`
    );
  }
}
