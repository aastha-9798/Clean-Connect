import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FeedResponse } from '../models/feed-response.model';

@Injectable({
  providedIn: 'root'
})
export class FeedService {

  constructor(private http: HttpClient) { }
  getFeed(): Observable<FeedResponse> {

    return this.http.get<FeedResponse>(
      `${environment.apiUrl}/drives/feed`
    );

  }
}
