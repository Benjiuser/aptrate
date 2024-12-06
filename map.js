// map.js

let map;
let placesService;
let markers = [];

const radiusInMeters = 16000; // about 10 miles
let infoWindow;
let apartmentsList;
let pagination = null;

let lastSearchCenter = null;
let lastZoomLevel = null;

// Dark map style array
const darkMapStyle = [
  {
    "elementType": "geometry",
    "stylers": [{ "color": "#242f3e" }]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [{ "color": "#242f3e" }]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#746855" }]
  },
  {
    "featureType": "administrative.locality",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#d59563" }]
  },
  {
    "featureType": "poi",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [{ "color": "#263c3f" }]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [{ "color": "#38414e" }]
  },
  {
    "featureType": "road",
    "elementType": "geometry.stroke",
    "stylers": [{ "color": "#212a37" }]
  },
  {
    "featureType": "road",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#9ca5b3" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [{ "color": "#746855" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry.stroke",
    "stylers": [{ "color": "#1f2835" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#f3d19c" }]
  },
  {
    "featureType": "transit",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{ "color": "#17263c" }]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#515c6d" }]
  }
];

window.initMap = function() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 30.2672, lng: -97.7431 },
    zoom: 13,
    styles: darkMapStyle,
    disableDefaultUI: true,
    gestureHandling: "greedy"
  });

  placesService = new google.maps.places.PlacesService(map);
  apartmentsList = document.getElementById('apartmentsList');
  infoWindow = new google.maps.InfoWindow();

  // Trigger searches on map idle
  map.addListener('idle', () => {
    maybeSearch();
  });

  // Initial search
  maybeSearch();
};

function maybeSearch() {
  const currentCenter = map.getCenter();
  const currentZoom = map.getZoom();

  if (currentZoom < 13) {
    clearApartmentsList();
    clearMarkers();
    console.log("Zoom in closer to see apartments.");
    return;
  }

  if (shouldSearchAgain(currentCenter, currentZoom)) {
    lastSearchCenter = currentCenter;
    lastZoomLevel = currentZoom;
    initialSearch(currentCenter);
  }
}

function shouldSearchAgain(center, zoom) {
  if (!lastSearchCenter || lastZoomLevel === null) return true;

  if (zoom !== lastZoomLevel) return true;

  const latDiff = Math.abs(center.lat() - lastSearchCenter.lat());
  const lngDiff = Math.abs(center.lng() - lastSearchCenter.lng());
  return (latDiff > 0.01 || lngDiff > 0.01);
}

function initialSearch(center) {
  clearApartmentsList();
  clearMarkers();

  const request = {
    location: center,
    radius: radiusInMeters,
    keyword: 'apartment OR condo'
  };

  placesService.nearbySearch(request, (results, status, pag) => {
    if (status === google.maps.places.PlacesServiceStatus.OK && results.length > 0) {
      displayApartments(results);
      pagination = pag;

      if (pagination && pagination.hasNextPage) {
        setTimeout(() => pagination.nextPage(), 2000);
      }
    } else {
      console.log("No apartments found in this area.");
      clearApartmentsList();
    }
  });
}

function displayApartments(apartments) {
  apartments.forEach((apartment) => {
    const distanceMiles = distanceBetweenLocations(
      map.getCenter().lat(), map.getCenter().lng(),
      apartment.geometry.location.lat(), apartment.geometry.location.lng()
    );

    const li = document.createElement('li');
    li.textContent = `${apartment.name} - ${distanceMiles.toFixed(2)} miles away`;
    apartmentsList.appendChild(li);

    const detailsRequest = {
      placeId: apartment.place_id,
      fields: [
        'name', 'formatted_phone_number', 'international_phone_number',
        'website', 'opening_hours', 'photos', 'vicinity', 'geometry'
      ]
    };

    placesService.getDetails(detailsRequest, (details, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && details) {
        addApartmentMarker(details, distanceMiles);
      } else {
        addApartmentMarker(apartment, distanceMiles);
      }
    });
  });

  if (window.currentUser && window.db) {
    saveApartmentsToUser(apartments);
  }

  // If more pages available, they will be fetched automatically
  if (pagination && pagination.hasNextPage) {
    setTimeout(() => pagination.nextPage(), 2000);
  }
}

function addApartmentMarker(placeDetails, distanceMiles) {
  const marker = new google.maps.Marker({
    position: placeDetails.geometry.location,
    map: map,
    title: placeDetails.name
  });
  markers.push(marker);

  marker.addListener('click', () => {
    let contentString = `
      <div style="color:#000;">
        <h2>${placeDetails.name}</h2>
        <p>${distanceMiles.toFixed(2)} miles away</p>
        <p><strong>Address:</strong> ${placeDetails.vicinity || 'N/A'}</p>
    `;

    if (placeDetails.formatted_phone_number) {
      contentString += `<p><strong>Phone:</strong> ${placeDetails.formatted_phone_number}</p>`;
    }

    if (placeDetails.website) {
      contentString += `<p><a href="${placeDetails.website}" target="_blank" rel="noopener">Visit Website</a></p>`;
    }

    if (placeDetails.opening_hours && placeDetails.opening_hours.weekday_text) {
      contentString += `<p><strong>Hours:</strong><br>${placeDetails.opening_hours.weekday_text.join('<br>')}</p>`;
    }

    if (placeDetails.photos && placeDetails.photos.length > 0) {
      const photoUrl = placeDetails.photos[0].getUrl({ maxWidth: 400 });
      contentString += `
        <div style="margin-top: 10px;">
          <img src="${photoUrl}" alt="Apartment Photo" style="max-width:100%; height:auto; border-radius:5px;">
        </div>
      `;
    }

    contentString += `</div>`;

    infoWindow.setContent(contentString);
    infoWindow.open(map, marker);
  });

  return marker;
}

function clearApartmentsList() {
  if (apartmentsList) {
    apartmentsList.innerHTML = '';
  }
}

function clearMarkers() {
  for (const marker of markers) {
    marker.setMap(null);
  }
  markers = [];
}

async function saveApartmentsToUser(apartments) {
  const userId = window.currentUser.uid;
  const userApartmentsRef = window.db.collection('users').doc(userId).collection('apartments');

  for (const apartment of apartments) {
    const distanceMiles = distanceBetweenLocations(
      map.getCenter().lat(), map.getCenter().lng(),
      apartment.geometry.location.lat(), apartment.geometry.location.lng()
    );

    await userApartmentsRef.doc(apartment.place_id).set({
      name: apartment.name,
      distanceMiles: distanceMiles,
      luxury: 'N/A',
      amenities: 'N/A',
      finalRating: 'N/A'
    });
  }
}

function distanceBetweenLocations(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);

  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.sin(dLon/2) * Math.sin(dLon/2) *
            Math.cos(lat1Rad) * Math.cos(lat2Rad);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function toRad(value) {
  return value * Math.PI / 180;
}
