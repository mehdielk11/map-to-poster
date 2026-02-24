export async function searchLocation(query, opts = {}) {
	if (!query || query.length < 2) return [];

	const { limit = 15, signal } = opts;

	try {
		const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=${limit}&addressdetails=1`;
		const response = await fetch(url, { signal, headers: { 'Accept': 'application/json' } });
		const data = await response.json();

		return data.map(item => ({
			name: item.display_name,
			lat: parseFloat(item.lat),
			lon: parseFloat(item.lon),
			shortName: item.name || (item.display_name && item.display_name.split(',')[0]) || item.display_name,
			country: item.address ? item.address.country : ''
		}));
	} catch (error) {
		if (error && error.name === 'AbortError') {
			return [];
		}
		console.error("Geocoding error:", error);
		return [];
	}
}

export function formatCoords(lat, lon) {
	const latDir = lat >= 0 ? 'N' : 'S';
	const lonDir = lon >= 0 ? 'E' : 'W';

	return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lon).toFixed(4)}° ${lonDir}`;
}

export async function reverseGeocode(lat, lon, opts = {}) {
	const { signal } = opts;
	try {
		const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;
		const response = await fetch(url, { signal, headers: { 'Accept': 'application/json' } });
		const data = await response.json();

		if (data && data.address) {
			const city = data.address.city || data.address.town || data.address.village || data.address.municipality || data.address.county || '';
			const country = data.address.country || '';
			return { city, country };
		}
		return null;
	} catch (error) {
		if (error && error.name === 'AbortError') return null;
		console.error("Reverse geocoding error:", error);
		return null;
	}
}
