import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild, ViewEncapsulation } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import * as L from 'leaflet';

import { MapService } from '../../core/services/map.service';
import { FeedService } from '../../core/services/feed.service';
import { FeedDrive } from '../../core/models/feed-drive.model';
import { FeedReport } from '../../core/models/feed-report.model';
import { MapItemsResponse } from '../../core/models/map-items.model';
import { LatLng, distanceMeters, formatDistance } from '../../core/utils/geo';
import { DETAIL_DIALOG_CONFIG } from '../../core/constants/dialog';
import { DriveDialogComponent } from '../../shared/drive-dialog/drive-dialog.component';
import { ReportDialogComponent } from '../../shared/report-dialog/report-dialog.component';
import { addBaseLayer, DEFAULT_CENTER, DEFAULT_ZOOM, PinKind, pinIcon } from '../../shared/map-pins';

// one pin on the map / row in the "Nearby" list
interface MapItem {
  key: string;      // unique across kinds, e.g. "drive:<id>"
  kind: PinKind;
  latitude: number;
  longitude: number;
  title: string;
  subtitle: string;
  image: string;
  distance: number; // metres from the user (or from the map centre)
  drive?: FeedDrive;
  report?: FeedReport;
}

const USER_ZOOM = 14;
const RELOAD_DELAY_MS = 300; // wait for panning/zooming to settle before loading

// Map of drives and open reports in the visible area, with a "Nearby" list sorted by distance.
// The map runs outside Angular's change detection (it fires many mouse events);
// results are brought back in with NgZone.run.
// ViewEncapsulation.None because the popups are created by Leaflet, outside this template.
@Component({
  selector: 'app-map',
  imports: [CommonModule, FormsModule, MatIconModule, DatePipe],
  templateUrl: './map.component.html',
  styleUrl: './map.component.css',
  encapsulation: ViewEncapsulation.None,
  providers: [DatePipe] // formats dates in the pin subtitles (uses the app's IST setting)
})
export class MapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapElement') mapElement!: ElementRef<HTMLDivElement>;

  showDrives = true;
  showReports = true;
  showCleaned = false; // "Recently cleaned" - off by default

  items: MapItem[] = [];
  loading = false;
  notice = '';
  userPosition: LatLng | null = null;

  private map!: L.Map;
  private markerLayer = L.layerGroup();
  private userLayer = L.layerGroup();
  private markers = new Map<string, L.Marker>();
  private reloadTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private mapService: MapService,
    private feedService: FeedService,
    private dialog: MatDialog,
    private zone: NgZone,
    private datePipe: DatePipe
  ) {}

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.map = L.map(this.mapElement.nativeElement, { zoomControl: true })
        .setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      addBaseLayer(this.map);
      this.markerLayer.addTo(this.map);
      this.userLayer.addTo(this.map);
      this.map.on('moveend', () => this.scheduleReload());
    });
    this.locateUser(true);
  }

  ngOnDestroy(): void {
    clearTimeout(this.reloadTimer);
    this.map?.remove();
  }

  // ---- list shown next to the map ----

  get visibleItems(): MapItem[] {
    return this.items.filter((item) => this.isShown(item.kind));
  }

  get distanceFrom(): string {
    return this.userPosition ? 'from you' : 'from the map centre';
  }

  formatDistance(meters: number): string {
    return formatDistance(meters);
  }

  count(kind: PinKind): number {
    return this.items.filter((item) => item.kind === kind).length;
  }

  // ---- user actions ----

  onFiltersChanged(): void {
    this.renderMarkers();
  }

  onCleanedToggled(): void {
    this.loadItems(); // cleaned spots are only fetched when asked for
  }

  locateMe(): void {
    this.locateUser(false);
  }

  focusItem(item: MapItem): void {
    const marker = this.markers.get(item.key);
    this.zone.runOutsideAngular(() => {
      this.map.setView([item.latitude, item.longitude], Math.max(this.map.getZoom(), 16));
      marker?.openPopup();
    });
  }

  openDetails(item: MapItem): void {
    const dialogRef = item.report
      ? this.dialog.open(ReportDialogComponent, { ...DETAIL_DIALOG_CONFIG, data: item.report })
      : this.dialog.open(DriveDialogComponent, { ...DETAIL_DIALOG_CONFIG, data: item.drive });
    dialogRef.afterClosed().subscribe((changed) => {
      if (changed) {
        this.loadItems();
      }
    });
  }

  // ---- location ----

  // On first load: centre on the user, or on recent activity if their location isn't available
  private locateUser(firstLoad: boolean): void {
    if (!navigator.geolocation) {
      this.fallbackCenter(firstLoad);
      return;
    }
    this.notice = '';
    navigator.geolocation.getCurrentPosition(
      (position) => this.zone.run(() => {
        const { latitude, longitude, accuracy } = position.coords;
        this.userPosition = { latitude, longitude };
        this.zone.runOutsideAngular(() => {
          this.userLayer.clearLayers();
          L.circle([latitude, longitude], { radius: accuracy, color: '#2563eb', weight: 1, fillOpacity: 0.08 })
            .addTo(this.userLayer);
          L.circleMarker([latitude, longitude], { radius: 8, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 })
            .bindTooltip('You are here')
            .addTo(this.userLayer);
          this.map.setView([latitude, longitude], USER_ZOOM);
        });
      }),
      () => this.zone.run(() => this.fallbackCenter(firstLoad)),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  }

  private fallbackCenter(firstLoad: boolean): void {
    this.notice = 'Your location isn\'t available, so the map shows recent activity. Allow location access and tap the locate button to see what\'s near you.';
    if (!firstLoad) {
      return;
    }
    // centre on the most recent report or drive, if there is one
    this.feedService.getFeed().subscribe({
      next: (feed) => {
        const recent = feed.reports[0] ?? feed.drives[0];
        this.zone.runOutsideAngular(() => {
          if (recent) {
            this.map.setView([recent.latitude, recent.longitude], USER_ZOOM - 1);
          } else {
            this.scheduleReload();
          }
        });
      },
      error: () => this.scheduleReload()
    });
  }

  // ---- loading ----

  private scheduleReload(): void {
    clearTimeout(this.reloadTimer);
    this.reloadTimer = setTimeout(() => this.zone.run(() => this.loadItems()), RELOAD_DELAY_MS);
  }

  private loadItems(): void {
    const bounds = this.map.getBounds().pad(0.25); // a little beyond the edges, so small pans don't need a reload
    this.loading = true;
    this.mapService.getItems({
      minLat: Math.max(-90, bounds.getSouth()),
      maxLat: Math.min(90, bounds.getNorth()),
      minLng: Math.max(-180, bounds.getWest()),
      maxLng: Math.min(180, bounds.getEast())
    }, this.showCleaned)
    .subscribe({
      next: (response) => {
        this.loading = false;
        this.items = this.toItems(response);
        this.renderMarkers();
      },
      error: (error) => {
        this.loading = false;
        console.error(error);
        this.notice = 'Couldn\'t load the map items. Please try again.';
      }
    });
  }

  private toItems(response: MapItemsResponse): MapItem[] {
    const center = this.map.getCenter();
    const from: LatLng = this.userPosition ?? { latitude: center.lat, longitude: center.lng };
    const distance = (latitude: number, longitude: number) => distanceMeters(from, { latitude, longitude });

    const items: MapItem[] = [
      ...response.drives.map((drive) => ({
        key: `drive:${drive.drive_id}`,
        kind: 'drive' as PinKind,
        latitude: drive.latitude,
        longitude: drive.longitude,
        title: drive.description,
        subtitle: `Drive · ${this.datePipe.transform(drive.scheduled_at, 'medium')}`,
        image: drive.image,
        distance: distance(drive.latitude, drive.longitude),
        drive
      })),
      ...response.reports.map((report) => ({
        key: `report:${report.id}`,
        kind: 'report' as PinKind,
        latitude: report.latitude,
        longitude: report.longitude,
        title: report.description || 'No description provided',
        subtitle: `Open report · ${this.datePipe.transform(report.date_reported, 'mediumDate')}`,
        image: report.image,
        distance: distance(report.latitude, report.longitude),
        report
      })),
      ...response.completed_drives.map((drive) => ({
        key: `cleaned:${drive.drive_id}`,
        kind: 'cleaned' as PinKind,
        latitude: drive.latitude,
        longitude: drive.longitude,
        title: drive.description,
        subtitle: `Cleaned · ${this.datePipe.transform(drive.completed_at, 'mediumDate')}`,
        image: drive.after_images[0] ?? drive.image,
        distance: distance(drive.latitude, drive.longitude),
        drive
      }))
    ];
    return items.sort((a, b) => a.distance - b.distance);
  }

  private isShown(kind: PinKind): boolean {
    return (kind === 'drive' && this.showDrives)
      || (kind === 'report' && this.showReports)
      || (kind === 'cleaned' && this.showCleaned);
  }

  // ---- markers ----

  // Updates the pins in place: existing ones are kept (so an open popup stays open when the
  // map reloads after panning), new ones are added and ones no longer shown are removed.
  private renderMarkers(): void {
    const items = this.visibleItems;
    const keep = new Set(items.map((item) => item.key));
    this.zone.runOutsideAngular(() => {
      for (const [key, marker] of this.markers) {
        if (!keep.has(key)) {
          this.markerLayer.removeLayer(marker);
          this.markers.delete(key);
        }
      }
      for (const item of items) {
        let marker = this.markers.get(item.key);
        if (!marker) {
          marker = L.marker([item.latitude, item.longitude], { icon: pinIcon(item.kind), title: item.title })
            .addTo(this.markerLayer);
          this.markers.set(item.key, marker);
        }
        // (re)bind so the popup shows the latest data and distance
        const popupItem = item;
        const popup = marker.getPopup();
        if (popup) {
          if (!marker.isPopupOpen()) {
            popup.setContent(() => this.popupContent(popupItem));
          }
        } else {
          marker.bindPopup(() => this.popupContent(popupItem), { minWidth: 220, maxWidth: 240 });
        }
      }
    });
  }

  // Built with DOM methods (not an HTML string) so text from reports can't inject markup
  private popupContent(item: MapItem): HTMLElement {
    const root = document.createElement('div');
    root.className = 'map-popup';

    if (item.image) {
      const img = document.createElement('img');
      img.src = item.image;
      img.alt = '';
      root.appendChild(img);
    }

    const title = document.createElement('strong');
    title.textContent = item.title;
    root.appendChild(title);

    const meta = document.createElement('span');
    meta.textContent = `${item.subtitle} · ${formatDistance(item.distance)} ${this.distanceFrom}`;
    root.appendChild(meta);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-primary btn-sm w-100';
    button.textContent = 'View details';
    button.addEventListener('click', () => this.zone.run(() => this.openDetails(item)));
    root.appendChild(button);

    return root;
  }
}
