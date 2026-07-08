"use client";

import L from "leaflet";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Fix ikon marker default Leaflet: import gambar dari node_modules tidak
// ke-resolve dengan benar di bawah Turbopack (properti `.src` jadi undefined,
// Leaflet lempar error "iconUrl not set"). Pakai URL CDN langsung sebagai
// gantinya — tidak bergantung pada bundler untuk aset paket ini.
const DEFAULT_ICON = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DEFAULT_ICON;

const INDONESIA_CENTER: [number, number] = [-2.5, 118];
const INDONESIA_ZOOM = 5;
const FOCUSED_ZOOM = 17;

function ClickHandler({ onChange }: { onChange: (lat: number, long: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LokasiMapPicker({
  lat,
  long,
  radiusMeter,
  onChange,
}: {
  lat: number;
  long: number;
  radiusMeter: number;
  onChange: (lat: number, long: number) => void;
}) {
  // Field Latitude/Longitude/Radius bisa sesaat jadi NaN saat sedang diketik
  // ulang (react-hook-form `valueAsNumber` menghasilkan NaN utk input kosong
  // atau setengah jalan, mis. "-" doang) — Leaflet lempar error kalau dikasih
  // NaN, jadi jatuhkan ke 0 dulu sampai angkanya valid lagi.
  const safeLat = Number.isFinite(lat) ? lat : 0;
  const safeLong = Number.isFinite(long) ? long : 0;
  const safeRadius = Number.isFinite(radiusMeter) ? radiusMeter : 0;

  const sudahDiisi = safeLat !== 0 || safeLong !== 0;
  const center: [number, number] = sudahDiisi ? [safeLat, safeLong] : INDONESIA_CENTER;
  const zoom = sudahDiisi ? FOCUSED_ZOOM : INDONESIA_ZOOM;

  return (
    <div className="h-75 w-full overflow-hidden rounded-lg border border-border">
      <MapContainer center={center} zoom={zoom} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker
          position={[safeLat, safeLong]}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target as L.Marker;
              const pos = marker.getLatLng();
              onChange(pos.lat, pos.lng);
            },
          }}
        />
        <Circle center={[safeLat, safeLong]} radius={safeRadius} />
        <ClickHandler onChange={onChange} />
      </MapContainer>
    </div>
  );
}
