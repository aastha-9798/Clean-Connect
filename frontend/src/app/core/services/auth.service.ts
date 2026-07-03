import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(private http: HttpClient) { }

  signup(data: any) {
    return this.http.post(
      `${environment.apiUrl}/auth/signup`,
      data
    );
  }

  login(data: any) {
    return this.http.post(
      `${environment.apiUrl}/auth/login`,
      data
    );
  }

  isLoggedIn() {
    return !!localStorage.getItem(
      'access_token'
    );
  } //here !! is js shorthand . !!(any val) true, !!(null) false
  
  logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  refreshAccessToken() {

    const refreshToken = this.getRefreshToken();
    return this.http.post<{
      access_token: string;
      token_type: string;
    }>(
      `${environment.apiUrl}/auth/refresh`,
      {},
      {
        headers: {
          Authorization: `Bearer ${refreshToken}`
        }
      }
    ).pipe(
      tap((response)=>{
        this.updateAccessToken(response.access_token);
      })
    )

  }
  updateAccessToken(token: string): void {

    localStorage.setItem(
      'access_token',
      token
    );

  }
}
