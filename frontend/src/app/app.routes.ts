import { Routes } from '@angular/router';
import { FeedComponent } from './pages/feed/feed.component';
import { LoginComponent } from './pages/login/login.component';
import { SignupComponent } from './pages/signup/signup.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { ReportComponent } from './pages/report/report.component';
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
        path: 'report',
        component: ReportComponent,
        canActivate: [authGuard]
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
