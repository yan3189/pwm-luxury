// ========== FILE: src/components/TrackingMap.jsx ==========
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

// Helper hitung jarak (km) antara dua koordinat
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

// Decode polyline dari Google Maps
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

// Icon rotatable untuk kendaraan
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

const defaultVehicleIcon = getRotatedIcon(0);

export default function TrackingMap({ 
  storeLocation,
  destination,
  courierLocation,
  polyline,
  courierHeading = 0,
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
    setVehicleIcon(getRotatedIcon(courierHeading || 0));
  }, [courierHeading]);
  
  // Auto zoom & follow saat kurir location berubah
  useEffect(() => {
    if (!mapRef.current) return;
    
    const map = mapRef.current;
    
    if (courierLocation && courierLocation[0] && courierLocation[1]) {
      // Jika ada tujuan, hitung jarak untuk menentukan zoom
      if (destination && destination[0] && destination[1]) {
        const distance = haversineDistance(
          courierLocation[0], courierLocation[1],
          destination[0], destination[1]
        );
        
        // Tentukan zoom level berdasarkan jarak (km)
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
        // Belum ada tujuan, zoom default
        map.setView(courierLocation, 14, { animate: true, duration: 0.5 });
      }
    } else if (storeLocation && storeLocation[0] && storeLocation[1]) {
      map.setView(storeLocation, 13, { animate: true, duration: 0.5 });
    }
  }, [courierLocation, destination, storeLocation]);
  
  // Tentukan center awal
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
        
        {/* Garis lurus dari kurir ke tujuan (fallback) */}
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