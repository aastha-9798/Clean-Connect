import * as L from 'leaflet';

export type PinKind = 'drive' | 'report' | 'cleaned' | 'picker';

const PIN_ICONS: Record<PinKind, string> = {
  drive: 'event',
  report: 'report',
  cleaned: 'task_alt',
  picker: 'place'
};

// Teardrop map pin drawn with HTML/CSS (styles: .cc-pin in styles.css), one colour per kind.
// Built from HTML instead of Leaflet's default marker images, which don't load in Angular builds.
export function pinIcon(kind: PinKind): L.DivIcon {
  return L.divIcon({
    className: 'cc-pin-wrapper',
    html: `<div class="cc-pin cc-pin-${kind}"><span class="material-icons">${PIN_ICONS[kind]}</span></div>`,
    iconSize: [34, 42],
    iconAnchor: [17, 42],   // the tip of the pin sits on the location
    popupAnchor: [0, -38]
  });
}

// Free OpenStreetMap tiles; fine for development and light use.
// For a public launch switch the URL to a tile provider's free tier (e.g. MapTiler or Stadia).
export function addBaseLayer(map: L.Map): void {
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
}

// Shown when we don't know where the user is (centre of India)
export const DEFAULT_CENTER: L.LatLngTuple = [22.5, 79];
export const DEFAULT_ZOOM = 5;
