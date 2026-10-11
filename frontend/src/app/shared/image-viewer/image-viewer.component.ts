import { Component, HostListener, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface ImageViewerData {
  images: string[];
  index: number; // photo to show first
  alt: string;
}

// Full-screen, uncropped view of photos. Opened as a dialog by the image gallery;
// Esc or a click outside the photo closes it, arrow keys switch photos.
@Component({
  selector: 'app-image-viewer',
  imports: [CommonModule, MatIconModule],
  templateUrl: './image-viewer.component.html',
  styleUrl: './image-viewer.component.css'
})
export class ImageViewerComponent {
  current: number;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ImageViewerData,
    private dialogRef: MatDialogRef<ImageViewerComponent>
  ) {
    this.current = data.index;
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      this.previous();
    } else if (event.key === 'ArrowRight') {
      this.next();
    }
  }

  previous(): void {
    this.current = (this.current - 1 + this.data.images.length) % this.data.images.length;
  }

  next(): void {
    this.current = (this.current + 1) % this.data.images.length;
  }

  close(): void {
    this.dialogRef.close();
  }
}
