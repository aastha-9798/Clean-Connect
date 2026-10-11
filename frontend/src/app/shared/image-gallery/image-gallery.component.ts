import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { ImageViewerComponent, ImageViewerData } from '../image-viewer/image-viewer.component';

// Shows one large photo with arrows and a row of thumbnails to switch between photos.
// Clicking the large photo opens it full screen, uncropped.
// Anything placed inside <app-image-gallery> (e.g. a status pill) is shown over the large photo.
@Component({
  selector: 'app-image-gallery',
  imports: [CommonModule, MatIconModule],
  templateUrl: './image-gallery.component.html',
  styleUrl: './image-gallery.component.css'
})
export class ImageGalleryComponent {
  @Input({ required: true }) images: string[] = [];
  @Input() alt = 'Photo';

  current = 0; // index of the photo shown large

  constructor(private dialog: MatDialog) {}

  show(index: number): void {
    this.current = index;
  }

  previous(): void {
    this.current = (this.current - 1 + this.images.length) % this.images.length;
  }

  next(): void {
    this.current = (this.current + 1) % this.images.length;
  }

  openViewer(): void {
    this.dialog.open<ImageViewerComponent, ImageViewerData>(ImageViewerComponent, {
      data: { images: this.images, index: this.current, alt: this.alt },
      panelClass: 'image-viewer-panel',
      backdropClass: 'image-viewer-backdrop',
      width: '100vw',
      height: '100vh',
      maxWidth: '100vw',
      maxHeight: '100vh'
    });
  }
}
