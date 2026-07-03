import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { switchMap, catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';

export const authInterceptor: HttpInterceptorFn = (req, next) => {

  const authService = inject(AuthService);
  const router = inject(Router);

  if (req.url.includes('/auth/refresh')) {
    return next(req);
  }

  const token = authService.getAccessToken();

  if (!token) {
    return next(req);
  }

  const authReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  return next(authReq).pipe(

    catchError((error) => {
      if (error.status !== 401) {
        return throwError(() => error);
      }
      return authService.refreshAccessToken().pipe(
         switchMap((response) => {
          console.log(response);
          
          const retryReq = req.clone({
            setHeaders: {
              Authorization:
                `Bearer ${response.access_token}`
            }
          });
          return next(retryReq);
        }),
        catchError((refreshError) => {
          authService.logout();
          router.navigate(['/login']);
          return throwError(() => refreshError);
        })

      );

    })

  );

};