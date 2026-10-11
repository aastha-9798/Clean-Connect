import { Routes } from '@angular/router';
import { FeedComponent } from './pages/feed/feed.component';
import { LoginComponent } from './pages/login/login.component';
import { SignupComponent } from './pages/signup/signup.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { DriveComponent } from './pages/drive/drive.component';
import { authGuard } from './core/guards/auth.guard';
import { ChatComponent } from './pages/chat/chat.component';

export const routes: Routes = [
    {
        path: '',
        component: FeedComponent
    },
    {
        path: 'login',
        component: LoginComponent
    },
    {
        path: 'signup',
        component: SignupComponent,
    },
    {
        path: 'profile',
        component: ProfileComponent,
        canActivate: [authGuard]
    },
    {
        // loaded on demand: it includes the map library (Leaflet) for the pin picker
        path: 'report',
        loadComponent: () => import('./pages/report/report.component').then((m) => m.ReportComponent),
        canActivate: [authGuard]
    },
    {
        path: 'map',
        loadComponent: () => import('./pages/map/map.component').then((m) => m.MapComponent)
    },
    {
        path: 'drive',
        component: DriveComponent,
        canActivate: [authGuard]
    },
    {
        path: 'ai',
        component: ChatComponent
    }

];
