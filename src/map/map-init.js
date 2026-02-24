import L from 'leaflet';
import maplibregl from 'maplibre-gl';
import { state, updateState, getSelectedTheme, getSelectedArtisticTheme } from '../core/state.js';
import { reverseGeocode } from './geocoder.js';

let map = null;
let tileLayer = null;
let marker = null;
let artisticMap = null;
let artisticMarker = null;
let currentArtisticThemeName = null;
let isSyncing = false;
let styleChangeInProgress = false;
let pendingArtisticStyle = null;
let pendingArtisticThemeName = null;
let currentRoadThickness = null;

async function updateLocationNames(lat, lon) {
	const res = await reverseGeocode(lat, lon);
	if (res && res.city) {
		updateState({
			city: res.city.toUpperCase(),
			country: res.country.toUpperCase()
		});
	}
}

const MARKER_ICONS = {
	pin: `
		<svg class="marker-pin" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
			<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
		</svg>
	`,
	circle: `
		<svg class="marker-pin" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
			<path fill-rule="evenodd" clip-rule="evenodd" d="M12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4ZM12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9Z" />
		</svg>
	`,
	heart: `
		<svg class="marker-pin" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
			<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
		</svg>
	`,
	star: `
		<svg class="marker-pin" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
			<path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
		</svg>
	`,
	none: `
		<svg class="marker-pin" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
			<circle cx="12" cy="12" r="2" />
		</svg>
	`
};

export function initMap(containerId, initialCenter, initialZoom, initialTileUrl) {
	map = L.map(containerId, {
		zoomControl: false,
		attributionControl: false,
		scrollWheelZoom: 'center',
		touchZoom: 'center'
	}).setView(initialCenter, initialZoom);

	tileLayer = L.tileLayer(initialTileUrl, {
		maxZoom: 19,
		crossOrigin: true,
	}).addTo(map);

	const customIcon = L.divIcon({
		className: 'custom-marker',
		html: MARKER_ICONS.pin,
		iconSize: [40, 40],
		iconAnchor: [20, 20]
	});
	marker = L.marker(initialCenter, {
		icon: customIcon,
		draggable: true,
		autoPan: true
	});

	marker.on('dragend', () => {
		const pos = marker.getLatLng();
		updateState({ markerLat: pos.lat, markerLon: pos.lng, lat: pos.lat, lon: pos.lng });
		if (artisticMarker) artisticMarker.setLngLat([pos.lng, pos.lat]);
		updateMapPosition(pos.lat, pos.lng);
		updateLocationNames(pos.lat, pos.lng);
	});

	map.on('moveend', () => {
		if (isSyncing) return;
		isSyncing = true;

		const center = map.getCenter();
		const zoom = map.getZoom();
		updateState({
			lat: center.lat,
			lon: center.lng,
			zoom: zoom
		});

		if (artisticMap) {
			artisticMap.jumpTo({
				center: [center.lng, center.lat],
				zoom: zoom - 1
			});
		}

		isSyncing = false;
	});

	initArtisticMap('artistic-map', [initialCenter[1], initialCenter[0]], initialZoom - 1);

	return map;
}

function initArtisticMap(containerId, center, zoom) {
	artisticMap = new maplibregl.Map({
		container: containerId,
		style: { version: 8, sources: {}, layers: [] },
		center: center,
		zoom: zoom,
		interactive: true,
		attributionControl: false,
		preserveDrawingBuffer: true
	});

	artisticMap.scrollZoom.setWheelZoomRate(1);
	artisticMap.scrollZoom.setZoomRate(1 / 600);

	artisticMap.on('style.load', () => {
		if (pendingArtisticStyle) {
			const next = pendingArtisticStyle;
			const nextName = pendingArtisticThemeName;
			pendingArtisticStyle = null;
			pendingArtisticThemeName = null;
			currentArtisticThemeName = nextName;
			artisticMap.setStyle(next);
		} else {
			styleChangeInProgress = false;
		}
	});
	artisticMap.on('moveend', () => {
		if (isSyncing) return;
		isSyncing = true;

		const center = artisticMap.getCenter();
		const zoom = artisticMap.getZoom();

		updateState({
			lat: center.lat,
			lon: center.lng,
			zoom: zoom + 1
		});

		if (map) {
			map.setView([center.lat, center.lng], zoom + 1, { animate: false });
		}

		isSyncing = false;
	});

	const el = document.createElement('div');
	el.className = 'custom-marker';
	el.innerHTML = MARKER_ICONS.pin;
	artisticMarker = new maplibregl.Marker({ element: el, draggable: true })
		.setLngLat(center);

	artisticMarker.on('dragend', () => {
		const pos = artisticMarker.getLngLat();
		updateState({ markerLat: pos.lat, markerLon: pos.lng, lat: pos.lat, lon: pos.lng });
		if (marker) marker.setLatLng([pos.lat, pos.lng]);
		updateMapPosition(pos.lat, pos.lng);
		updateLocationNames(pos.lat, pos.lng);
	});
}

function getIconAnchor(iconName, size) {
	if (iconName === 'pin') return [size / 2, size];
	return [size / 2, size / 2];
}

export function updateMarkerIcon(iconName, size) {
	const html = MARKER_ICONS[iconName] || MARKER_ICONS.pin;
	const anchor = getIconAnchor(iconName, size);

	if (marker) {
		const newIcon = L.divIcon({
			className: 'custom-marker',
			html: html,
			iconSize: [size, size],
			iconAnchor: anchor
		});
		marker.setIcon(newIcon);
	}

	if (artisticMarker) {
		const el = artisticMarker.getElement();
		el.innerHTML = html;
		el.style.width = `${size}px`;
		el.style.height = `${size}px`;

	}
}

export function updateMarkerSize(size, iconName) {
	updateMarkerIcon(iconName, size);
}

export function updateMarkerVisibility(show) {
	if (marker) {
		if (show) marker.addTo(map);
		else marker.remove();
	}
	if (artisticMarker) {
		if (show) artisticMarker.addTo(artisticMap);
		else artisticMarker.remove();
	}
}

export function updateMarkerPosition(lat, lon) {
	if (marker) marker.setLatLng([lat, lon]);
	if (artisticMarker) artisticMarker.setLngLat([lon, lat]);
}

export function updateArtisticStyle(theme) {
	if (!artisticMap) return;
	const roadThicknessChanged = currentRoadThickness !== state.roadThickness;
	if (!roadThicknessChanged && currentArtisticThemeName === theme.name) return;

	currentArtisticThemeName = theme.name;
	currentRoadThickness = state.roadThickness;
	const style = generateMapLibreStyle(theme);

	if (styleChangeInProgress) {
		pendingArtisticStyle = style;
		pendingArtisticThemeName = theme.name;
		try { artisticMap.setStyle(style); } catch (e) { }
		return;
	}

	styleChangeInProgress = true;
	try {
		artisticMap.setStyle(style);
	} catch (e) {
		pendingArtisticStyle = style;
		pendingArtisticThemeName = theme.name;
	}
}

function zoomLineWidth(base, scaleFactor) {
	const s = scaleFactor * (state.roadThickness || 2.5); // Use dynamic road thickness
	return [
		'interpolate', ['linear'], ['zoom'],
		5, base * 0.4 * s,
		8, base * 0.6 * s,
		10, base * 0.8 * s,
		12, base * 1.0 * s,
		14, base * 1.6 * s,
		16, base * 2.5 * s,
		18, base * 4.0 * s
	];
}

export function evaluateLineWidth(baseWidth, scaleFactor, zoom) {
	const s = scaleFactor * (state.roadThickness || 2.5); // Use dynamic road thickness
	const stops = [
		[5, baseWidth * 0.4 * s],
		[8, baseWidth * 0.6 * s],
		[10, baseWidth * 0.8 * s],
		[12, baseWidth * 1.0 * s],
		[14, baseWidth * 1.6 * s],
		[16, baseWidth * 2.5 * s],
		[18, baseWidth * 4.0 * s]
	];
	if (zoom <= stops[0][0]) return stops[0][1];
	if (zoom >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];
	for (let i = 0; i < stops.length - 1; i++) {
		if (zoom >= stops[i][0] && zoom <= stops[i + 1][0]) {
			const t = (zoom - stops[i][0]) / (stops[i + 1][0] - stops[i][0]);
			return stops[i][1] + t * (stops[i + 1][1] - stops[i][1]);
		}
	}
	return baseWidth * s;
}

export function generateMapLibreStyle(theme, scaleFactor = 1) {
	return {
		version: 8,
		names: theme.name,
		sources: {
			openfreemap: {
				type: 'vector',
				url: 'https://tiles.openfreemap.org/planet'
			}
		},
		layers: [
			{
				id: 'background',
				type: 'background',
				paint: { 'background-color': theme.bg }
			},
			{
				id: 'water',
				source: 'openfreemap',
				'source-layer': 'water',
				type: 'fill',
				paint: { 'fill-color': theme.water }
			},
			{
				id: 'park',
				source: 'openfreemap',
				'source-layer': 'park',
				type: 'fill',
				paint: { 'fill-color': theme.parks }
			},
			{
				id: 'road-default',
				source: 'openfreemap',
				'source-layer': 'transportation',
				type: 'line',
				filter: ['!', ['match', ['get', 'class'], ['motorway', 'primary', 'secondary', 'tertiary', 'residential'], true, false]],
				paint: { 'line-color': theme.road_default, 'line-width': zoomLineWidth(0.5, scaleFactor) }
			},
			{
				id: 'road-residential',
				source: 'openfreemap',
				'source-layer': 'transportation',
				type: 'line',
				filter: ['==', ['get', 'class'], 'residential'],
				paint: { 'line-color': theme.road_residential, 'line-width': zoomLineWidth(0.5, scaleFactor) }
			},
			{
				id: 'road-tertiary',
				source: 'openfreemap',
				'source-layer': 'transportation',
				type: 'line',
				filter: ['==', ['get', 'class'], 'tertiary'],
				paint: { 'line-color': theme.road_tertiary, 'line-width': zoomLineWidth(0.8, scaleFactor) }
			},
			{
				id: 'road-secondary',
				source: 'openfreemap',
				'source-layer': 'transportation',
				type: 'line',
				filter: ['==', ['get', 'class'], 'secondary'],
				paint: { 'line-color': theme.road_secondary, 'line-width': zoomLineWidth(1.0, scaleFactor) }
			},
			{
				id: 'road-primary',
				source: 'openfreemap',
				'source-layer': 'transportation',
				type: 'line',
				filter: ['==', ['get', 'class'], 'primary'],
				paint: { 'line-color': theme.road_primary, 'line-width': zoomLineWidth(1.5, scaleFactor) }
			},
			{
				id: 'road-motorway',
				source: 'openfreemap',
				'source-layer': 'transportation',
				type: 'line',
				filter: ['==', ['get', 'class'], 'motorway'],
				paint: { 'line-color': theme.road_motorway, 'line-width': zoomLineWidth(2.0, scaleFactor) }
			}
		]
	};
}

export function applyExportScale(theme, scaleFactor) {
	if (!artisticMap) return;
	const style = generateMapLibreStyle(theme, scaleFactor);
	try {
		artisticMap.setStyle(style);
	} catch (e) {
		console.warn('Failed to apply export scale:', e);
	}
}

export function revertExportScale(theme) {
	if (!artisticMap) return;
	currentArtisticThemeName = null;
	const style = generateMapLibreStyle(theme, 1);
	styleChangeInProgress = true;
	try {
		artisticMap.setStyle(style);
	} catch (e) {
		console.warn('Failed to revert export scale:', e);
	}
}

export function updateMapPosition(lat, lon, zoom, options = { animate: true }) {
	if (map) {
		if (lat !== undefined && lon !== undefined) {
			map.setView([lat, lon], zoom || map.getZoom(), options);
		} else if (zoom !== undefined) {
			map.setZoom(zoom, options);
		}
	}
}

export function updateMapTheme(tileUrl) {
	if (tileLayer) {
		tileLayer.setUrl(tileUrl);
	}
}

export function waitForTilesLoad(timeout = 5000) {
	return new Promise((resolve) => {
		if (!map || !tileLayer) return resolve();

		try {
			if (tileLayer._tiles) {
				const tiles = Object.values(tileLayer._tiles || {});
				const anyLoading = tiles.some(t => {
					const el = t.el || t.tile || (t._el);
					return el && el.complete === false;
				});
				if (!anyLoading) return resolve();
			}
		} catch (e) {
		}

		let resolved = false;
		const onLoad = () => {
			if (resolved) return;
			resolved = true;
			clearTimeout(timer);
			resolve();
		};

		tileLayer.once('load', onLoad);

		const timer = setTimeout(() => {
			if (resolved) return;
			resolved = true;
			resolve();
		}, timeout);
	});
}

export function waitForArtisticIdle(timeout = 2000) {
	return new Promise((resolve) => {
		if (!artisticMap) return resolve();

		let resolved = false;
		const onIdle = () => {
			if (resolved) return;
			resolved = true;
			clearTimeout(timer);
			resolve();
		};

		try {
			artisticMap.once('idle', onIdle);
		} catch (e) {
			resolve();
			return;
		}

		const timer = setTimeout(() => {
			if (resolved) return;
			resolved = true;
			resolve();
		}, timeout);
	});
}

export function getMapInstance() {
	return map;
}

export function getArtisticMapInstance() {
	return artisticMap;
}

export function invalidateMapSize() {
	if (map) {
		map.invalidateSize({ animate: false });
	}
	if (artisticMap) {
		artisticMap.resize();
	}
}

export function updateMarkerStyles(state) {
	const iconType = state.markerIcon || 'pin';
	const baseSize = 40;
	const size = Math.round(baseSize * (state.markerSize || 1));

	const isArtistic = state.renderMode === 'artistic';
	const theme = isArtistic ? getSelectedArtisticTheme() : getSelectedTheme();
	let color = isArtistic ? (theme.road_primary || theme.text || '#0f172a') : (theme.textColor || '#0f172a');

	if (state.markerColor && state.markerColor !== 'theme') {
		color = state.markerColor;
	}

	const html = (MARKER_ICONS[iconType] || MARKER_ICONS.pin)
		.replace('class="marker-pin"', `style="width: ${size}px; height: ${size}px; color: ${color};"`);

	const anchorX = size / 2;
	const anchorY = iconType === 'pin' ? size : size / 2;

	if (marker) {
		if (state.showMarker) {
			const icon = L.divIcon({
				className: 'custom-marker',
				html: html,
				iconSize: [size, size],
				iconAnchor: [anchorX, anchorY]
			});
			marker.setIcon(icon);
			marker.setLatLng([state.markerLat, state.markerLon]);
			if (!map.hasLayer(marker)) marker.addTo(map);
		} else {
			if (map.hasLayer(marker)) map.removeLayer(marker);
		}
	}

	if (artisticMap) {
		if (artisticMarker) {
			artisticMarker.remove();
		}

		if (state.showMarker) {
			const el = document.createElement('div');
			el.className = 'custom-marker';
			el.innerHTML = html;
			el.style.width = `${size}px`;
			el.style.height = `${size}px`;

			artisticMarker = new maplibregl.Marker({
				element: el,
				draggable: true,
				anchor: iconType === 'pin' ? 'bottom' : 'center'
			})
				.setLngLat([state.markerLon, state.markerLat])
				.addTo(artisticMap);

			artisticMarker.on('dragend', () => {
				const pos = artisticMarker.getLngLat();
				updateState({ markerLat: pos.lat, markerLon: pos.lng, lat: pos.lat, lon: pos.lng });
				if (marker) marker.setLatLng([pos.lat, pos.lng]);
				updateMapPosition(pos.lat, pos.lng);
				updateLocationNames(pos.lat, pos.lng);
			});
		}
	}
}

export function enableMarkerPlacementMode() {
	const mapContainer = document.getElementById('poster-container');
	if (!mapContainer) return;

	mapContainer.style.cursor = 'crosshair';
	const artisticContainer = document.getElementById('artistic-map');
	const stdContainer = document.getElementById('map-preview');
	if (artisticContainer) artisticContainer.style.cursor = 'crosshair';
	if (stdContainer) stdContainer.style.cursor = 'crosshair';

	const removePlacementMode = () => {
		mapContainer.style.cursor = '';
		if (artisticContainer) artisticContainer.style.cursor = '';
		if (stdContainer) stdContainer.style.cursor = '';
		if (map) map.off('click', onMapClick);
		if (artisticMap) artisticMap.off('click', onArtisticMapClick);
	};

	const onMapClick = (e) => {
		const lat = e.latlng.lat;
		const lon = e.latlng.lng;
		updateState({ markerLat: lat, markerLon: lon, lat: lat, lon: lon, showMarker: true });
		updateMarkerStyles(state); // Ensure style updates immediately
		updateMapPosition(lat, lon);
		removePlacementMode();
		updateLocationNames(lat, lon);
	};

	const onArtisticMapClick = (e) => {
		const lat = e.lngLat.lat;
		const lon = e.lngLat.lng;
		updateState({ markerLat: lat, markerLon: lon, lat: lat, lon: lon, showMarker: true });
		updateMarkerStyles(state); // Ensure style updates immediately
		updateMapPosition(lat, lon);
		removePlacementMode();
		updateLocationNames(lat, lon);
	};

	if (map) map.once('click', onMapClick);
	if (artisticMap) artisticMap.once('click', onArtisticMapClick);
}
