// Import Mapbox as an ESM module
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
//Importing d3
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
// Check that Mapbox GL JS is loaded
// console.log('Mapbox GL JS Loaded:', mapboxgl);

// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1IjoiZ3JhY2VnbWMiLCJhIjoiY21hc250ZzBkMG83ejJsb2dmbXZwNWczZiJ9.67i3hUHHWqgkdtoFWXa4Eg';

// Initialize the map
const map = new mapboxgl.Map({
    container: 'map', // ID of the div where the map will render
    style: 'mapbox://styles/mapbox/streets-v12', // Map style
    center: [-71.09415, 42.36027], // [longitude, latitude]
    zoom: 12, // Initial zoom level
    minZoom: 5, // Minimum allowed zoom
    maxZoom: 18, // Maximum allowed zoom
});

//defining public variables
let circles;

//defining functions
function getCoords(station) {
    const point = new mapboxgl.LngLat(+station.lon, +station.lat); // Convert lon/lat to Mapbox LngLat
    const { x, y } = map.project(point); // Project to pixel coordinates
    return { cx: x, cy: y }; // Return as object for use in SVG attributes
}
function updatePositions() {
    circles
      .attr('cx', (d) => getCoords(d).cx) // Set the x-position using projected coordinates
      .attr('cy', (d) => getCoords(d).cy); // Set the y-position using projected coordinates
}
function computeStationTraffic(stations, trips) {
    // Compute departures
    const departures = d3.rollup(
      trips,
      (v) => v.length,
      (d) => d.start_station_id,
    );
  
    const arrivals = d3.rollup(
        trips,
        (v) => v.length,
        (d) => d.end_station_id,
    );
  
    // Update each station..
    return stations.map((station) => {
        let id = station.short_name;
        station.arrivals = arrivals.get(id) ?? 0;
        station.departures = departures.get(id) ?? 0;
        station.totalTraffic = station.arrivals + station.departures;
        return station;
    });
}
  

  
// map.on(load...)
map.on('load', async () => {
    map.addSource('boston_route', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
    });
    map.addSource('cambridge_route', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson',
    });

    const bikeLaneStyle = {
        'line-color': '#32D400',
        'line-width': 5,
        'line-opacity': 0.6
    };

    map.addLayer({
        id: 'boston-bike-lanes',
        type: 'line',
        source: 'boston_route',
        paint: bikeLaneStyle 
    });
    map.addLayer({
        id: 'cambridge-bike-lanes',
        type: 'line',
        source: 'cambridge_route',
        paint: bikeLaneStyle 
    });

    let jsonData;
    try {
        const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
        // Await JSON fetch
        jsonData = await d3.json(jsonurl);
        console.log('Loaded JSON Data:', jsonData); // Log to verify structure
    } catch (error) {
        console.error('Error loading JSON:', error); // Handle errors
    }

    let stations = jsonData.data.stations;
        console.log('Stations Array:', stations);

    // Adding data about bike traffic
    let trips;
    try {
    trips = await d3.csv(csvUrl, d => ({
        ride_id: d.ride_id,
        bike_type: d.bike_type,
        started_at: new Date(d.started_at),
        ended_at: new Date(d.ended_at),
        start_station_id: d.start_station_id,
        end_station_id: d.end_station_id,
        is_member: +d.is_member  // Convert to number
    }));

    console.log('Loaded trips:', trips.length, 'entries');
    } catch (error) {
    console.error('Error loading CSV:', error);
    }

    const departures = d3.rollup(
        trips,
        (v) => v.length,
        (d) => d.start_station_id,
    );

    const arrivals = d3.rollup(
        trips,
        (v) => v.length,
        (d) => d.end_station_id,
    );

    stations = stations.map((station) => {
        let id = station.short_name;
        station.arrivals = arrivals.get(id) ?? 0;
        station.departures = departures.get(id) ?? 0;
        station.totalTraffic = station.arrivals + station.departures;
        return station;
    });
    console.log(stations.slice(0, 5));  // Check first 5 stations
    const radiusScale = d3
        .scaleSqrt()
        .domain([0, d3.max(stations, (d) => d.totalTraffic)])
        .range([0, 25]);
        const svg = d3.select('#map').select('svg');
        circles = svg
            .selectAll('circle')
            .data(stations)
            .enter()
            .append('circle')
            .attr('r', d => radiusScale(d.totalTraffic)) // Radius of the circle
            .each(function (d) {
                // Append a <title> element for browser tooltip
                d3.select(this)
                  .append('title')
                  .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
            });
    
    // reactive sliders
    const timeSlider = document.getElementById('#time-slider');
    const selectedTime = document.getElementById('#selected-time');
    const anyTimeLabel = document.getElementById('#any-time');

    // reactive slider funtions
    function formatTime(minutes) {
        const date = new Date(0, 0, 0, 0, minutes); // Set hours & minutes
        return date.toLocaleString('en-US', { timeStyle: 'short' }); // Format as HH:MM AM/PM
    }
    function updateTimeDisplay() {
        timeFilter = Number(timeSlider.value); // Get slider value
      
        if (timeFilter === -1) {
          selectedTime.textContent = ''; // Clear time display
          anyTimeLabel.style.display = 'block'; // Show "(any time)"
        } else {
          selectedTime.textContent = formatTime(timeFilter); // Display formatted time
          anyTimeLabel.style.display = 'none'; // Hide "(any time)"
        }
      
        // Trigger filtering logic which will be implemented in the next step
    }

    timeSlider.addEventListener('input', updateTimeDisplay);
    updateTimeDisplay();
    // Initial position update when map loads
    updatePositions();
        
});
// Reposition markers on map interactions
map.on('move', updatePositions); // Update during map movement
map.on('zoom', updatePositions); // Update during zooming
map.on('resize', updatePositions); // Update on window resize
map.on('moveend', updatePositions); // Final adjustment after movement ends
const csvUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';

