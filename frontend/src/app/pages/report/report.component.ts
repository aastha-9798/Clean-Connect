import { Component , OnInit} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import {  ReactiveFormsModule,  FormGroup,  FormControl} from '@angular/forms';
import { ReportService } from '../../core/services/report.service';
import { LocationPickerComponent, PickedLocation } from '../../shared/location-picker/location-picker.component';

@Component({
  selector: 'app-report',
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, LocationPickerComponent],
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

  readonly maxImages = 5;                 // same limits as the backend
  readonly maxImageSize = 5 * 1024 * 1024; // 5 MB

  // photos picked so far, in order (the first one becomes the cover)
  selectedImages: { file: File; preview: string }[] = [];
  successMessage = '';
  errorMessage = '';

  ngOnInit(): void {

  }
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const files = Array.from(input.files);
    input.value = ''; // clear it so picking the same file again still fires (change)
    this.errorMessage = '';

    for (const file of files) {
      if (this.selectedImages.length >= this.maxImages) {
        this.errorMessage = `You can add up to ${this.maxImages} photos`;
        break;
      }
      if (file.size > this.maxImageSize) {
        this.errorMessage = `"${file.name}" is larger than 5 MB`;
        continue;
      }
      const image = { file, preview: '' };
      this.selectedImages.push(image);
      const reader = new FileReader();
      reader.onload = () => {
        image.preview = reader.result as string;
      };
      reader.readAsDataURL(file);
    }

  }
  // how precise "Use current location" was, in metres (laptops are often off by 100+ m)
  locationAccuracy: number | null = null;

  // the location as numbers for the pin picker (the form keeps them as text)
  get pickedLatitude(): number | null {
    const value = parseFloat(this.reportForm.value.latitude ?? '');
    return isNaN(value) ? null : value;
  }

  get pickedLongitude(): number | null {
    const value = parseFloat(this.reportForm.value.longitude ?? '');
    return isNaN(value) ? null : value;
  }

  // the pin was dropped or dragged on the map
  onPinMoved(location: PickedLocation): void {
    this.reportForm.patchValue({
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString()
    });
    this.locationAccuracy = null; // the user chose the exact spot themselves
    this.errorMessage = '';
  }

  removeImage(index: number): void {
    this.selectedImages.splice(index, 1);
    this.errorMessage = '';
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
        this.locationAccuracy = Math.round(position.coords.accuracy);

        this.errorMessage = '';

      },

      () => {

        this.errorMessage = 'Unable to retrieve location';

      }

    );

  }
  onSubmit(): void {

    if (this.selectedImages.length === 0) {

      this.errorMessage = 'Please add at least one photo';

      return;
    }

    const formData = new FormData();

    for (const image of this.selectedImages) {
      formData.append(
        'images',
        image.file
      );
    }

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

          this.selectedImages = [];
          this.locationAccuracy = null;

        },

        error: (error) => {

          console.error(error);

          this.successMessage = '';

          // show the backend's reason when it gives one (e.g. "Image 3: Invalid file type...")
          this.errorMessage =
            typeof error.error?.detail === 'string'
              ? error.error.detail
              : 'Failed to submit report';

        }

      });

  }

}
