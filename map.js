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
let trips;
const csvUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';
const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
let svg = d3.select('#map').select('svg');
    if (svg.empty()) {
        svg = d3.select('#map').append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .style('position', 'absolute')
            .style('top', 0)
            .style('left', 0);
    }


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
function formatTime(minutes) {
    const date = new Date(0, 0, 0, 0, minutes); // Set hours & minutes
    return date.toLocaleString('en-US', { timeStyle: 'short' }); // Format as HH:MM AM/PM
}
function minutesSinceMidnight(date) {
    return date.getHours() * 60 + date.getMinutes();
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
        // Await JSON fetch
        jsonData = await d3.json(jsonurl);
        // console.log('Loaded JSON Data:', jsonData); // Log to verify structure
    } catch (error) {
        console.error('Error loading JSON:', error); // Handle errors
    }

    // Adding data about bike traffic
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
    
        // console.log('Loaded trips:', trips.length, 'entries');
        } catch (error) {
        console.error('Error loading CSV:', error); //debugging log
        }
    let stations = computeStationTraffic(jsonData.data.stations, trips);
    // console.log('Stations Array:', stations); //debugging log
    let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);


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
    
    // console.log(stations.slice(0, 5));  // debugging log Check first 5 stations
    const radiusScale = d3
        .scaleSqrt()
        .domain([0, d3.max(stations, (d) => d.totalTraffic)])
        .range([0, 25]);
    
    circles = svg
        .selectAll('circle')
        .data(stations, (d) => d.short_name) // Use station short_name as the ke
        .enter()
        .append('circle')
        .attr('r', d => radiusScale(d.totalTraffic)) // Radius of the circle
        .style('--departure-ratio', (d) =>
            stationFlow(d.departures / d.totalTraffic),
        );
        // .each(function (d) {
        //     // Append a <title> element for browser tooltip
        //     d3.select(this)
        //     .attr('title', d => `${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
        // });

    // tooltip
    const tooltip = d3.select('#tooltip');
    circles
        .on('mouseover', function (event, d) {
            tooltip
            .style('display', 'block')
            .html(`
                <strong>${d.name}</strong><br>
                ${d.totalTraffic} trips<br>
                ${d.departures} departures<br>
                ${d.arrivals} arrivals
            `);
            d3.select(this).attr('stroke', 'white').attr('stroke-width', 2);
        })
        .on('mousemove', function (event) {
            tooltip
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 20) + 'px');
        })
        .on('mouseout', function () {
            tooltip.style('display', 'none');
            d3.select(this).attr('stroke', null);
        });


    
    // reactive sliders
    const timeSlider = document.getElementById('time-slider');
    const selectedTime = document.getElementById('selected-time');
    const anyTimeLabel = document.getElementById('any-time');

    // reactive slider funtions
    function updateTimeDisplay() {
        let timeFilter = Number(timeSlider.value); // Get slider value
      
        if (timeFilter === -1) {
          selectedTime.textContent = ''; // Clear time display
          anyTimeLabel.style.display = 'block'; // Show "(any time)"
        } else {
          selectedTime.textContent = formatTime(timeFilter); // Display formatted time
          anyTimeLabel.style.display = 'none'; // Hide "(any time)"
        }
      
        // Call updateScatterPlot to reflect the changes on the map
        updateScatterPlot(timeFilter);
      }
      
    function filterTripsbyTime(trips, timeFilter) {
        return timeFilter === -1
          ? trips // If no filter is applied (-1), return all trips
          : trips.filter((trip) => {
              // Convert trip start and end times to minutes since midnight
              const startedMinutes = minutesSinceMidnight(trip.started_at);
              const endedMinutes = minutesSinceMidnight(trip.ended_at);
      
              // Include trips that started or ended within 60 minutes of the selected time
              return (
                Math.abs(startedMinutes - timeFilter) <= 60 ||
                Math.abs(endedMinutes - timeFilter) <= 60
              );
            });
    }
    function updateScatterPlot(timeFilter) {
        // Get only the trips that match the selected time filter
        const filteredTrips = filterTripsbyTime(trips, timeFilter);
      
        // Recompute station traffic based on the filtered trips
        const filteredStations = computeStationTraffic(stations, filteredTrips);

        // ensure circles are scale appropreiately for the number of trips
        timeFilter === -1 ? radiusScale.range([0, 25]) : radiusScale.range([3, 50]);

      
        // Update the scatterplot by adjusting the radius of circles
        circles
            .data(filteredStations, (d) => d.short_name)
            .join('circle') // Ensure the data is bound correctly
            .style('--departure-ratio', (d) =>
                stationFlow(d.departures / d.totalTraffic),
            )
            .attr('r', (d) => radiusScale(d.totalTraffic)); // Update circle sizes
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