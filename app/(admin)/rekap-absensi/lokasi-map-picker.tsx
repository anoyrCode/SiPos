"use client";

import L from "leaflet";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Fix ikon marker default Leaflet yang rusak di bundler Next.js/webpack.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x.src,
  iconUrl: markerIcon.src,
  shadowUrl: markerShadow.src,
});

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
  const sudahDiisi = lat !== 0 || long !== 0;
  const center: [number, number] = sudahDiisi ? [lat, long] : INDONESIA_CENTER;
  const zoom = sudahDiisi ? FOCUSED_ZOOM : INDONESIA_ZOOM;

  return (
    <div className="h-75 w-full overflow-hidden rounded-lg border border-border">
      <MapContainer center={center} zoom={zoom} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker
          position={[lat, long]}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target as L.Marker;
              const pos = marker.getLatLng();
              onChange(pos.lat, pos.lng);
            },
          }}
        />
        <Circle center={[lat, long]} radius={radiusMeter} />
        <ClickHandler onChange={onChange} />
      </MapContainer>
    </div>
  );
}
