import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { UserService } from '../../core/services/user.service';
import { UserReport } from '../../core/models/user-report.model';
import { UserDrive } from '../../core/models/user-drive.model';
import { CommonModule, DatePipe } from '@angular/common';

@Component({
  selector: 'app-profile',
  imports: [CommonModule, DatePipe, RouterLink, MatIconModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit {
  constructor(
    private userService: UserService
  ) {}
  reports: UserReport[] = [];
  drives: UserDrive[] = [];

  ngOnInit(): void {
    this.userService.getMyReports()
      .subscribe({
        next: (reports) => {
          console.log(reports);
          this.reports = reports;
        },
        error: (error) => {
          console.error(error);
        }

      });
    this.userService.getMyDrives()
      .subscribe({
        next: (drives) => {
          console.log(drives);
          this.drives = drives;
        },
        error: (error) => {
          console.error(error);
        }

      });
  }

}
