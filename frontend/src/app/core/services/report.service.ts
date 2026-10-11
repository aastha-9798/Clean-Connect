import { Injectable} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
@Injectable({
  providedIn: 'root'
})
export class ReportService {

  constructor( private http: HttpClient) {}
  uploadReport(formData: FormData) {

    return this.http.post(
      `${environment.apiUrl}/reports/upload`,
      formData
    );

  }
  deleteReport(reportId: number) {

    return this.http.delete(
      `${environment.apiUrl}/reports/${reportId}`
    );

  }
}
