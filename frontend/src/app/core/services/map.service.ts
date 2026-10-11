import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MapBounds, MapItemsResponse } from '../models/map-items.model';

@Injectable({
  providedIn: 'root'
})
export class MapService {

  constructor(private http: HttpClient) { }

  getItems(bounds: MapBounds, includeCleaned: boolean): Observable<MapItemsResponse> {

    const params = new HttpParams()
      .set('min_lat', bounds.minLat)
      .set('max_lat', bounds.maxLat)
      .set('min_lng', bounds.minLng)
      .set('max_lng', bounds.maxLng)
      .set('include_cleaned', includeCleaned);

    return this.http.get<MapItemsResponse>(
      `${environment.apiUrl}/map/items`,
      { params }
    );

  }
}
