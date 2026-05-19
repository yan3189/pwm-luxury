// ========== FILE: src/components/LocationPicker.jsx ==========
// Komponen pilih lokasi dengan Google Maps Autocomplete + Peta interaktif
import { useState, useRef, useEffect } from 'react';
import { useLoadScript, Autocomplete, GoogleMap, Marker } from '@react-google-maps/api';

const libraries = ['places'];
const mapContainerStyle = { width: '100%', height: '300px' };

export default function LocationPicker({ initialLat, initialLng, onLocationChange }) {
  const [selectedLat, setSelectedLat] = useState(initialLat || -6.200000);
  const [selectedLng, setSelectedLng] = useState(initialLng || 106.816666);
  const [address, setAddress] = useState('');
  const [mapCenter, setMapCenter] = useState({ lat: initialLat || -6.200000, lng: initialLng || 106.816666 });
  const autocompleteRef = useRef(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries,
  });

  // Jika koordinat dari props berubah (edit data lama)
  useEffect(() => {
    if (initialLat && initialLng) {
      setSelectedLat(initialLat);
      setSelectedLng(initialLng);
      setMapCenter({ lat: initialLat, lng: initialLng });
      // Reverse geocoding: koordinat → alamat (opsional, bisa skip)
    }
  }, [initialLat, initialLng]);

  const onPlaceSelected = () => {
    const place = autocompleteRef.current.getPlace();
    if (place.geometry) {
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      setSelectedLat(lat);
      setSelectedLng(lng);
      setMapCenter({ lat, lng });
      setAddress(place.formatted_address);
      if (onLocationChange) {
        onLocationChange({ lat, lng, address: place.formatted_address });
      }
    }
  };

  const onMapClick = (event) => {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    setSelectedLat(lat);
    setSelectedLng(lng);
    setMapCenter({ lat, lng });
    if (onLocationChange) {
      onLocationChange({ lat, lng, address: '' }); // alamat dikosongkan, nanti bisa reverse geocode
    }
  };

  if (!isLoaded) return <div className="text-gray-400">Memuat peta...</div>;

  return (
    <div className="space-y-3">
      {/* Input Autocomplete */}
      <div>
        <label className="block text-sm text-gray-400 mb-1">Cari Alamat</label>
        <Autocomplete onLoad={(ref) => (autocompleteRef.current = ref)} onPlaceChanged={onPlaceSelected}>
          <input
            type="text"
            placeholder="Ketik alamat store..."
            className="w-full p-2 rounded bg-black/50 border border-white/20"
            defaultValue={address}
          />
        </Autocomplete>
        <p className="text-gray-500 text-xs mt-1">Ketik alamat lalu pilih dari saran. Anda juga bisa klik peta langsung.</p>
      </div>

      {/* Peta */}
      <div>
        <label className="block text-sm text-gray-400 mb-1">Titik Lokasi (geser marker jika perlu)</label>
        <GoogleMap mapContainerStyle={mapContainerStyle} zoom={15} center={mapCenter} onClick={onMapClick}>
          <Marker position={{ lat: selectedLat, lng: selectedLng }} draggable onDragEnd={onMapClick} />
        </GoogleMap>
      </div>

      {/* Preview koordinat */}
      <div className="text-xs text-gray-500 bg-gray-900/50 p-2 rounded">
        Koordinat: {selectedLat.toFixed(6)}, {selectedLng.toFixed(6)}
      </div>
    </div>
  );
}