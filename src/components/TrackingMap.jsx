// ========== FILE: src/components/TrackingMap.jsx ==========
// Komponen peta tracking reusable dengan marker segitiga dan polyline
import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix untuk marker icon Leaflet di Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({ 
  iconUrl: icon, 
  shadowUrl: iconShadow, 
  iconSize: [25, 41], 
  iconAnchor: [12, 41] 
});
L.Marker.prototype.options.icon = DefaultIcon;

// Fungsi untuk decode polyline dari Google Maps
function decodePolyline(encoded) {
  if (!encoded) return [];
  let points = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;
  
  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;
    
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;
    
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

// Buat icon kurir berbentuk segitiga (seperti kendaraan)
function createVehicleIcon(heading = 0) {
  // Heading dalam derajat (0 = utara, 90 = timur, dll)
  const rotation = heading || 0;
  
  // Buat canvas untuk marker segitiga
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  
  // Gambar segitiga (menghadap ke atas, akan di-rotate)
  ctx.clearRect(0, 0, 32, 32);
  
  // Warna biru untuk kurir
  ctx.fillStyle = '#3B82F6';
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 4;
  
  // Gambar segitiga (pointer ke atas)
  ctx.beginPath();
  ctx.moveTo(16, 4);      // Puncak (atas)
  ctx.lineTo(6, 26);      // Kiri bawah
  ctx.lineTo(16, 20);     // tengah dalam
  ctx.lineTo(26, 26);     // kanan bawah
  ctx.closePath();
  ctx.fill();
  
  // Tambahkan lingkaran kecil di tengah
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(16, 16, 4, 0, 2 * Math.PI);
  ctx.fill();
  
  // Rotasi berdasarkan heading
  // Catatan: Leaflet tidak support rotasi langsung, jadi kita perlu membuat icon dengan rotasi
  // Atau menggunakan CSS transform. Untuk sementara, kita buat icon tanpa rotasi dulu.
  
  return L.divIcon({
    html: `<div style="
      width: 32px;
      height: 32px;
      transform: rotate(${rotation}deg);
      transform-origin: center;
      transition: transform 0.3s ease;
    ">${canvas.outerHTML}</div>`,
    className: 'custom-vehicle-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
}

// Icon default untuk kendaraan (tanpa rotasi)
const defaultVehicleIcon = L.divIcon({
  html: `<svg width="32" height="32" viewBox="0 0 32 32" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
    <path d="M16 2 L6 26 L16 20 L26 26 Z" fill="#3B82F6" stroke="#2563EB" stroke-width="1.5"/>
    <circle cx="16" cy="16" r="4" fill="white"/>
  </svg>`,
  className: 'custom-vehicle-icon',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

// Icon rotatable menggunakan L.marker dengan CSS transform
function getRotatedIcon(heading) {
  return L.divIcon({
    html: `<div style="
      width: 32px;
      height: 32px;
      transform: rotate(${heading}deg);
      transform-origin: center;
      transition: transform 0.2s linear;
    ">
      <svg width="32" height="32" viewBox="0 0 32 32" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
        <path d="M16 2 L6 26 L16 20 L26 26 Z" fill="#3B82F6" stroke="#2563EB" stroke-width="1.5"/>
        <circle cx="16" cy="16" r="4" fill="white"/>
      </svg>
    </div>`,
    className: 'custom-vehicle-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
}

export default function TrackingMap({ 
  storeLocation,    // [lat, lng] lokasi store
  destination,      // [lat, lng] lokasi tujuan
  courierLocation,  // [lat, lng] lokasi kurir saat ini
  polyline,         // encoded polyline dari Google Maps
  courierHeading,   // arah kurir (derajat)
  storeName,
  destinationAddress
}) {
  const mapRef = useRef(null);
  const [decodedPolyline, setDecodedPolyline] = useState([]);
  const [vehicleIcon, setVehicleIcon] = useState(defaultVehicleIcon);
  
  useEffect(() => {
    if (polyline) {
      const decoded = decodePolyline(polyline);
      setDecodedPolyline(decoded);
    }
  }, [polyline]);
  
  // Update icon saat heading berubah
  useEffect(() => {
    if (courierHeading !== undefined && courierHeading !== null) {
      setVehicleIcon(getRotatedIcon(courierHeading));
    }
  }, [courierHeading]);
  
  // Tentukan center peta: prioritas courier, lalu store, lalu default
  const mapCenter = courierLocation || storeLocation || [-6.200000, 106.816666];
  const zoom = courierLocation ? 15 : 13;
  
  return (
    <div style={{ height: '500px', width: '100%' }}>
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        whenCreated={(map) => { mapRef.current = map; }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CartoDB'
        />
        
        {/* Store Marker */}
        {storeLocation && storeLocation[0] && storeLocation[1] && (
          <Marker position={storeLocation}>
            <Popup>📍 Store: {storeName || 'Store'}</Popup>
          </Marker>
        )}
        
        {/* Destination Marker */}
        {destination && destination[0] && destination[1] && (
          <Marker position={destination}>
            <Popup>🏠 Tujuan: {destinationAddress || 'Tujuan'}</Popup>
          </Marker>
        )}
        
        {/* Courier Marker (segitiga) */}
        {courierLocation && courierLocation[0] && courierLocation[1] && (
          <Marker 
            position={courierLocation} 
            icon={vehicleIcon}
          >
            <Popup>🛵 Kurir sedang dalam perjalanan</Popup>
          </Marker>
        )}
        
        {/* Route Polyline (dari Google Maps) */}
        {decodedPolyline && decodedPolyline.length > 0 && (
          <Polyline
            positions={decodedPolyline}
            color="#2563EB"
            weight={4}
            opacity={0.8}
            smoothFactor={1}
          />
        )}
        
        {/* Garis lurus dari kurir ke tujuan (sebagai alternatif jika polyline tidak ada) */}
        {!decodedPolyline.length && courierLocation && destination && (
          <Polyline
            positions={[courierLocation, destination]}
            color="#F59E0B"
            weight={3}
            opacity={0.7}
            dashArray="5, 10"
          />
        )}
      </MapContainer>
    </div>
  );
}