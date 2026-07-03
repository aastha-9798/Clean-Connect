import { Component , OnInit} from '@angular/core';
import { CommonModule } from '@angular/common';
import {  ReactiveFormsModule,  FormGroup,  FormControl} from '@angular/forms';
import { ReportService } from '../../core/services/report.service';

@Component({
  selector: 'app-report',
  imports: [ CommonModule, ReactiveFormsModule],
  templateUrl: './report.component.html',
  styleUrl: './report.component.css'
})
export class ReportComponent implements OnInit {
  constructor(
    private reportService: ReportService
  ) {}

  reportForm = new FormGroup({
    latitude: new FormControl(''),
    longitude: new FormControl(''),
    description: new FormControl('')
  });

  selectedFile: File | null = null; //union type
  imagePreview: string | null = null;
  successMessage = '';
  errorMessage = '';

  ngOnInit(): void {

  }
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    if (file.size > 5 * 1024 * 1024) {
      this.errorMessage = 'Image size must be less than 5 MB';
      return;
    }
    this.selectedFile = file;
    this.errorMessage = '';
    const reader = new FileReader();
    reader.onload = () => {
      this.imagePreview = reader.result as string;
    };
    reader.readAsDataURL(file);

  }
  getLocation(): void {

    if (!navigator.geolocation) {

      this.errorMessage = 'Geolocation is not supported';

      return;
    }

    navigator.geolocation.getCurrentPosition(

      (position) => {

        this.reportForm.patchValue({

          latitude: position.coords.latitude.toString(),

          longitude: position.coords.longitude.toString()

        });

        this.errorMessage = '';

      },

      () => {

        this.errorMessage = 'Unable to retrieve location';

      }

    );

  }
  onSubmit(): void {

    if (!this.selectedFile) {

      this.errorMessage = 'Please select an image';

      return;
    }

    const formData = new FormData();

    formData.append(
      'image',
      this.selectedFile
    );

    formData.append(
      'latitude',
      this.reportForm.value.latitude || ''
    );

    formData.append(
      'longitude',
      this.reportForm.value.longitude || ''
    );

    formData.append(
      'description',
      this.reportForm.value.description || ''
    );

    this.reportService.uploadReport(formData)
      .subscribe({

        next: (response) => {

          console.log(response);

          this.successMessage =
            'Report submitted successfully';

          this.errorMessage = '';

          this.reportForm.reset();

          this.selectedFile = null;

          this.imagePreview = null;

        },

        error: (error) => {

          console.error(error);

          this.successMessage = '';

          this.errorMessage =
            'Failed to submit report';

        }

      });

  }

}
