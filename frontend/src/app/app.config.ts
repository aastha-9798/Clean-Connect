import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors} from '@angular/common/http';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { routes } from './app.routes';
import { DATE_PIPE_DEFAULT_OPTIONS } from '@angular/common';
import { APP_TIMEZONE } from './core/constants/timezone';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient( withInterceptors([authInterceptor]) ),
    // every | date in the app shows times in IST
    { provide: DATE_PIPE_DEFAULT_OPTIONS, useValue: { timezone: APP_TIMEZONE } }
  ]
};
