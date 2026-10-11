import {
  AfterViewInit, Component, ElementRef, EventEmitter, Input, NgZone, OnChanges, OnDestroy,
  Output, SimpleChanges, ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { addBaseLayer, DEFAULT_CENTER, DEFAULT_ZOOM, pinIcon } from '../map-pins';

export interface PickedLocation {
  latitude: number;
  longitude: number;
}

const PIN_ZOOM = 17; // close enough to place the pin on the exact spot

// Small map with a draggable pin for choosing an exact location.
// Clicking the map moves the pin there; dragging it fine-tunes the spot.
// Setting [latitude]/[longitude] from outside (e.g. "Use current location") moves the pin and zooms in.
@Component({
  selector: 'app-location-picker',
  imports: [CommonModule],
  templateUrl: './location-picker.component.html',
  styleUrl: './location-picker.component.css'
})
export class LocationPickerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() latitude: number | null = null;
  @Input() longitude: number | null = null;
  @Output() locationChange = new EventEmitter<PickedLocation>();

  @ViewChild('mapElement') mapElement!: ElementRef<HTMLDivElement>;

  private map?: L.Map;
  private marker?: L.Marker;

  constructor(private zone: NgZone) {}

  get hasPin(): boolean {
    return this.latitude !== null && this.longitude !== null;
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.map = L.map(this.mapElement.nativeElement).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      addBaseLayer(this.map);
      this.map.on('click', (event: L.LeafletMouseEvent) => this.placePin(event.latlng, true));
      // the map can be created before the page has its final size
      setTimeout(() => this.map?.invalidateSize(), 0);
    });
    this.syncPinFromInputs();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['latitude'] || changes['longitude']) && this.map) {
      this.syncPinFromInputs();
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  // moves the pin to the [latitude]/[longitude] given by the parent (or removes it when cleared)
  private syncPinFromInputs(): void {
    if (!this.map) {
      return;
    }
    if (!this.hasPin) {
      this.zone.runOutsideAngular(() => {
        this.marker?.remove();
        this.marker = undefined;
      });
      return;
    }
    const target = L.latLng(this.latitude!, this.longitude!);
    const current = this.marker?.getLatLng();
    if (current && current.distanceTo(target) < 0.5) {
      return; // the change came from dragging the pin here - don't move or re-zoom the map
    }
    this.zone.runOutsideAngular(() => {
      this.placePin(target, false);
      this.map!.setView(target, PIN_ZOOM);
    });
  }

  private placePin(latlng: L.LatLng, userMoved: boolean): void {
    if (!this.marker) {
      this.marker = L.marker(latlng, { icon: pinIcon('picker'), draggable: true, autoPan: true })
        .addTo(this.map!);
      this.marker.on('dragend', () => this.emit(this.marker!.getLatLng()));
    } else {
      this.marker.setLatLng(latlng);
    }
    if (userMoved) {
      this.emit(latlng);
    }
  }

  private emit(latlng: L.LatLng): void {
    this.zone.run(() => this.locationChange.emit({
      latitude: Number(latlng.lat.toFixed(6)),
      longitude: Number(latlng.lng.toFixed(6))
    }));
  }
}
