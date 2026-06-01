// ========== FILE: src/components/TrackingMap.jsx ==========
import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Helper hitung jarak
function haversineDistance(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => deg * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Decode polyline
function decodePolyline(encoded) {
  if (!encoded) return [];
  let points = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;
  while (index < len) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

// ========== MARKER STORE (LOGO BULAT) ==========
function createStoreIcon(logoUrl, storeName) {
  if (logoUrl) {
    // Gunakan logo store sebagai marker bulat
    return L.divIcon({
      html: `<div style="
        width: 40px;
        height: 40px;
        background-image: url(${logoUrl});
        background-size: cover;
        background-position: center;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
      "></div>`,
      className: 'custom-store-icon',
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -20]
    });
  } else {
    // Fallback: icon default
    return L.divIcon({
      html: `<div style="
        width: 36px;
        height: 36px;
        background-color: #10B981;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
      ">🏪</div>`,
      className: 'custom-store-icon',
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -18]
    });
  }
}

// ========== MARKER TUJUAN ($ + PANAH KE BAWAH + ANIMASI BOUNCE) ==========
// Tanpa lingkaran, hanya teks $ dan panah yang bergerak
const destinationIcon = L.divIcon({
  html: `<div style="
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    animation: bounce 1s ease-in-out infinite;
    filter: drop-shadow(0 7px 7px rgba(0,0,0,0.9));
    cursor: pointer;
  ">
    <div style="
      font-size: 28px;
      font-weight: bold;
      color: #F59E0B;
      text-shadow: 0 2px 4px rgba(0,0,0,0.3);
      line-height: 1;
    ">$</div>
    <div style="
      font-size: 20px;
      color: #F59E0B;
      margin-top: -6px;
      text-shadow: 0 2px 4px rgba(0,0,0,0.3);
    ">▼</div>
    <style>
      @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
    </style>
  </div>`,
  className: 'custom-destination-icon',
  iconSize: [40, 60],  // Lebar 40, tinggi 60 (ruang untuk animasi)
  iconAnchor: [5, 50], // Anchor di ujung panah (bagian bawah)
  popupAnchor: [0, -30] // Popup muncul di atas marker
});

// ========== MARKER KURIR (SEGITIGA ROTATABLE) ==========
function getRotatedIcon(heading) {
  return L.divIcon({
    html: `<div style="
      width: 32px;
      height: 32px;
      transform: rotate(${heading}deg);
      transform-origin: center;
      transition: transform 0.2s linear;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
    ">
      <svg width="32" height="32" viewBox="0 0 32 32">
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

const defaultVehicleIcon = getRotatedIcon(0);

export default function TrackingMap({ 
  storeLocation,
  storeLogo,
  storeName,
  destination,
  destinationAddress,
  courierLocation,
  polyline,
  courierHeading = 0
}) {
  const mapRef = useRef(null);
  const [decodedPolyline, setDecodedPolyline] = useState([]);
  const [vehicleIcon, setVehicleIcon] = useState(defaultVehicleIcon);
  const [storeIcon, setStoreIcon] = useState(null);
  
  useEffect(() => {
    if (polyline) {
      setDecodedPolyline(decodePolyline(polyline));
    }
  }, [polyline]);
  
  // Update icon saat heading berubah
  useEffect(() => {
    setVehicleIcon(getRotatedIcon(courierHeading || 0));
  }, [courierHeading]);
  
  // Buat icon store saat logo tersedia
  useEffect(() => {
    setStoreIcon(createStoreIcon(storeLogo, storeName));
  }, [storeLogo, storeName]);
  
  // Auto zoom & follow
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    
    if (courierLocation && courierLocation[0] && courierLocation[1]) {
      if (destination && destination[0] && destination[1]) {
        const distance = haversineDistance(
          courierLocation[0], courierLocation[1],
          destination[0], destination[1]
        );
        let zoomLevel = 15;
        if (distance > 10) zoomLevel = 11;
        else if (distance > 5) zoomLevel = 12;
        else if (distance > 2) zoomLevel = 13;
        else if (distance > 1) zoomLevel = 14;
        else if (distance > 0.5) zoomLevel = 15;
        else if (distance > 0.2) zoomLevel = 16;
        else zoomLevel = 17;
        map.setView(courierLocation, zoomLevel, { animate: true, duration: 0.5 });
      } else {
        map.setView(courierLocation, 14, { animate: true, duration: 0.5 });
      }
    } else if (storeLocation && storeLocation[0] && storeLocation[1]) {
      map.setView(storeLocation, 13, { animate: true, duration: 0.5 });
    }
  }, [courierLocation, destination, storeLocation]);
  
  const initialCenter = courierLocation || storeLocation || [-6.200000, 106.816666];
  const initialZoom = courierLocation ? 14 : 13;
  
  return (
    <div style={{ height: '500px', width: '100%' }}>
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        style={{ height: '100%', width: '100%' }}
        whenCreated={(map) => { mapRef.current = map; }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CartoDB'
        />
        
        {/* Store Marker (Logo Bulat) */}
        {storeLocation && storeLocation[0] && storeLocation[1] && storeIcon && (
          <Marker position={storeLocation} icon={storeIcon}>
            <Popup>📍 {storeName || 'Store'}</Popup>
          </Marker>
        )}
        
        {/* Destination Marker ($ + Panah + Animasi Bounce) */}
        {destination && destination[0] && destination[1] && (
          <Marker position={destination} icon={destinationIcon}>
            <Popup>🏠 Tujuan: {destinationAddress || 'Alamat Pengiriman'}</Popup>
          </Marker>
        )}
        
        {/* Courier Marker (Segitiga Rotatable) */}
        {courierLocation && courierLocation[0] && courierLocation[1] && (
          <Marker position={courierLocation} icon={vehicleIcon}>
            <Popup>🛵 Kurir sedang dalam perjalanan</Popup>
          </Marker>
        )}
        
        {/* Route Polyline */}
        {decodedPolyline && decodedPolyline.length > 0 && (
          <Polyline
            positions={decodedPolyline}
            color="#2563EB"
            weight={4}
            opacity={0.8}
            smoothFactor={1}
          />
        )}
        
        {/* Garis lurus fallback */}
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