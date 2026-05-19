// ========== FILE: src/components/AddressPicker.jsx ==========
// Komponen input alamat dengan Google Maps (untuk member)
import { useState, useRef, useEffect } from 'react';
import { useLoadScript, Autocomplete, GoogleMap, Marker } from '@react-google-maps/api';

const libraries = ['places'];
const mapContainerStyle = { width: '100%', height: '250px' };

export default function AddressPicker({ initialLat, initialLng, initialAddress, onAddressChange }) {
  const [selectedLat, setSelectedLat] = useState(initialLat || -6.200000);
  const [selectedLng, setSelectedLng] = useState(initialLng || 106.816666);
  const [address, setAddress] = useState(initialAddress || '');
  const [mapCenter, setMapCenter] = useState({ lat: initialLat || -6.200000, lng: initialLng || 106.816666 });
  const autocompleteRef = useRef(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries,
  });

  useEffect(() => {
    if (initialLat && initialLng) {
      setSelectedLat(initialLat);
      setSelectedLng(initialLng);
      setMapCenter({ lat: initialLat, lng: initialLng });
    }
    if (initialAddress) setAddress(initialAddress);
  }, [initialLat, initialLng, initialAddress]);

  const onPlaceSelected = () => {
    const place = autocompleteRef.current.getPlace();
    if (place.geometry) {
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      setSelectedLat(lat);
      setSelectedLng(lng);
      setMapCenter({ lat, lng });
      setAddress(place.formatted_address);
      if (onAddressChange) onAddressChange({ lat, lng, address: place.formatted_address });
    }
  };

  const onMapClick = (event) => {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    setSelectedLat(lat);
    setSelectedLng(lng);
    setMapCenter({ lat, lng });
    if (onAddressChange) onAddressChange({ lat, lng, address });
  };

  if (!isLoaded) return <div className="text-gray-400">Memuat peta...</div>;

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm text-gray-400 mb-1">Cari Alamat</label>
        <Autocomplete onLoad={(ref) => (autocompleteRef.current = ref)} onPlaceChanged={onPlaceSelected}>
          <input
            type="text"
            placeholder="Ketik alamat lengkap..."
            className="w-full p-2 rounded bg-black/50 border border-white/20"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </Autocomplete>
      </div>

      <div>
        <GoogleMap mapContainerStyle={mapContainerStyle} zoom={15} center={mapCenter} onClick={onMapClick}>
          <Marker position={{ lat: selectedLat, lng: selectedLng }} draggable onDragEnd={onMapClick} />
        </GoogleMap>
      </div>

      <div className="text-xs text-gray-500">
        Koordinat: {selectedLat.toFixed(6)}, {selectedLng.toFixed(6)}
      </div>
    </div>
  );
}