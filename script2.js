let map;
let infowindow;
let glacierLayer, rockLayer, debrisLayer; 
let glacierLocations = {};
let glacierFeatures = {};
let selectedFeature = null;
let glacierList = d3.select("#glacierList"); 
let velocityOverlay;
let glacierData = {}; 
let globalAverage = {}; 
let xScale; 
let yScale;
let selectedDomain = null; 
let glacierDataPoints = [];

function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 46.044870, lng: 10.251466 }, 
        zoom: 7,
        mapTypeId: "satellite",
    });

    infowindow = new google.maps.InfoWindow();
    
    glacierLayer = new google.maps.Data();
    rockLayer = new google.maps.Data(); 
    debrisLayer = new google.maps.Data(); 

    glacierLayer.setMap(map);
    
    // Get slider and display elements
    const slider = document.getElementById("year-slider");
    const display = document.getElementById("year-display");

    // Mise à jour dynamique de l'année
    slider.addEventListener("input", function () {
        display.textContent = this.value;
    });

    function loadGlacierData(year) {
        let glacierFile = (year === "2025") 
            ? "filtered_glims_alpines_recents_f.geojson"  
            : `glacier_years/glaciers_${year}.geojson`;   

        glacierLayer.forEach(feature => glacierLayer.remove(feature));

        d3.json(glacierFile).then(data => {
            glacierLayer.addGeoJson(data);

            glacierLayer.setStyle({
                fillColor: "blue",
                strokeColor: "black",
                strokeWeight: 1,
                fillOpacity: 0.5
            });

            let glacierNames = [];
            data.features.forEach(feature => {
                let name = feature.properties.glac_name;
                if (name) {
                    let geometry = feature.geometry;
                    let latLng = computeCentroid(geometry);

                    glacierLocations[name.toLowerCase()] = latLng;
                    glacierFeatures[name.toLowerCase()] = feature;
                    glacierNames.push(name);
                }
            });

            glacierNames.sort();
            glacierList.selectAll("option")
                .data(glacierNames)
                .enter()
                .append("option")
                .attr("value", d => d);
        }).catch(error => console.error(`Erreur chargement ${glacierFile}:`, error));
    }
        
    loadGlacierData(slider.value);

    slider.addEventListener("input", function () {
        display.textContent = this.value;
        loadGlacierData(this.value);
    });

    function loadLayer(layer, file, color) {
        d3.json(file).then(data => {
            layer.addGeoJson(data);
            layer.setStyle({
                fillColor: color,
                strokeColor: "black",
                strokeWeight: 1,
                fillOpacity: 0.5
            });
        }).catch(error => console.error(`Erreur chargement ${file}:`, error));
    }

    function toggleLayer(layer, file, color, checkboxId) {
        d3.select(checkboxId).on("change", function () {
            if (this.checked) {
                loadLayer(layer, file, color);
                layer.setMap(map);
            } else {
                layer.setMap(null);
            }
        });
    }

    toggleLayer(rockLayer, "filtered_glims_alpine_recents_rocks.geojson", "brown", "#toggle-rocks");
    toggleLayer(debrisLayer, "filtered_glims_alpine_recents_debris.geojson", "gray", "#toggle-debris");

    d3.json("glaciers_areas_f2.json").then(data => {
        glacierData = data;
        let allDates = {}; 

        Object.values(glacierData).forEach(glacier => {
            glacier.forEach(entry => {
                let date = entry.date;
                if (!allDates[date]) {
                    allDates[date] = { sum: 0, count: 0 };
                }
                allDates[date].sum += entry.db_area;
                allDates[date].count += 1;
            });
        });

        globalAverage = Object.keys(allDates).map(date => ({
            date: date,
            db_area: allDates[date].sum / allDates[date].count
        }));
    });

    d3.select("#toggle-lines").on("change", function() {
        glacierLayer.setMap(this.checked ? map : null);
    });

    let velocityOverlay = null;
    d3.select("#toggle-velocity").on("change", function () {
        if (this.checked) {
            if (!velocityOverlay) {
                const imageBounds = {
                    north: 47.612951,
                    south: 44.701317,
                    east: 13.601868,
                    west: 5.945968,
                };
                const imageURL = "v_log.png";  
                velocityOverlay = new google.maps.GroundOverlay(imageURL, imageBounds);
            }
            velocityOverlay.setMap(map);
        } else {
            if (velocityOverlay) {
                velocityOverlay.setMap(null);
            }
        }
    });

    glacierLayer.addListener("click", event => {
        resetGlacierColors();
        selectedFeature = event.feature;
        glacierLayer.overrideStyle(selectedFeature, { fillColor: "red", strokeColor: "red" });

        let name = selectedFeature.getProperty("glac_name") || "Inconnu";
        let area = selectedFeature.getProperty("db_area") ? selectedFeature.getProperty("db_area").toFixed(2) + " km²" : "Non renseigné";
        let lastSurvey = formatDate(selectedFeature.getProperty("src_date"));

        let content = `<div>
                         <strong>Glacier :</strong> ${name}<br>
                         <strong>Superficie :</strong> ${area}<br>
                         <strong>Dernière étude :</strong> ${lastSurvey}<br>
                       </div>`;

        infowindow.setContent(content);
        infowindow.setPosition(event.latLng);
        infowindow.open(map);

        updateGlacierInfo(name, area, lastSurvey, selectedFeature.getProperty("glac_id"));
    });

    infowindow.addListener("closeclick", () => {
        resetGlacierColors();
        updateGlacierInfo(null, "", "");
    });
}

function computeCentroid(geometry) {
    let latSum = 0, lngSum = 0, count = 0;
    if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
        geometry.coordinates.forEach(polygon => {
            polygon.forEach(coord => { 
                let lng = parseFloat(coord[0]); 
                let lat = parseFloat(coord[1]); 
                if (!isNaN(lat) && !isNaN(lng)) {
                    latSum += lat;
                    lngSum += lng;
                    count++;
                }
            });
        });
        if (count > 0) {
            return new google.maps.LatLng(latSum / count, lngSum / count); 
        }
    } else if (geometry.type === "Point") {
        return new google.maps.LatLng(geometry.coordinates[1], geometry.coordinates[0]);
    }
    return null;
}

function resetGlacierColors() {
    glacierLayer.revertStyle();
}

function formatDate(isoDate) {
    if (!isoDate) return "Date inconnue"; 
    let date = new Date(isoDate);
    if (isNaN(date.getTime())) return "Date inconnue";
    const moisFrancais = ["janvier", "février", "mars", "avril", "mai", "juin",
        "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
    return `${date.getDate()} ${moisFrancais[date.getMonth()]} ${date.getFullYear()}`;
}

window.initMap = initMap;