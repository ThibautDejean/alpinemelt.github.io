let map;
let infowindow;
let glacierLayer; 
let glacierLocations = {};
let glacierFeatures = {};
let selectedFeature = null;
let glacierList = d3.select("#glacierList"); 
let velocityOverlay;



function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 45.9237, lng: 6.8694 },
        zoom: 7,
        mapTypeId: "satellite",
    });

    infowindow = new google.maps.InfoWindow();
    glacierLayer = new google.maps.Data();
    glacierLayer.setMap(map);

    d3.json("glims_alpines_recents_f.geojson").then(data => {
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
                let latLng;

                if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
                    let latSum = 0, lngSum = 0, count = 0;
                
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
                        latLng = new google.maps.LatLng(latSum / count, lngSum / count); 
                    }
                } else if (geometry.type === "Point") {
                    latLng = new google.maps.LatLng(geometry.coordinates[1], geometry.coordinates[0]);
                }

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
    });

    d3.select("#toggle-lines").on("change", function() {
        glacierLayer.setMap(this.checked ? map : null);
    });

    let velocityOverlay = null;

    // Gestion du toggle pour l'image de vélocité
    d3.select("#toggle-velocity").on("change", function() {
        if (this.checked) {
            if (!velocityOverlay) {

                const imageBounds = {
                    north: 47.506951,
                    south: 44.695317,
                    east: 13.681868,
                    west: 6.025968,
                  };

                const imageURL = "velocite_t.png";  

                velocityOverlay = new google.maps.GroundOverlay(imageURL, imageBounds);
                console.log("Overlay créé :", velocityOverlay);
            }
            velocityOverlay.setMap(map);  
            console.log("Overlay ajouté à la carte :", velocityOverlay.getMap());

        } else {
            if (velocityOverlay) {
                velocityOverlay.setMap(null);
            }
        }
    });

    //  Gestion des clics sur les glaciers 
    glacierLayer.addListener("click", event => {
        resetGlacierColors();
    
        selectedFeature = event.feature;

        glacierLayer.overrideStyle(selectedFeature, { fillColor: "red", strokeColor: "red" });

        let name = selectedFeature.getProperty("glac_name") || "Inconnu";
        let area = selectedFeature.getProperty("db_area") ? selectedFeature.getProperty("db_area").toFixed(2) + " km²" : "Non renseigné";
        let lastSurvey = selectedFeature.getProperty("src_date") || "Date inconnue";

        let content = `<div>
                         <strong>Glacier :</strong> ${name}<br>
                         <strong>Superficie :</strong> ${area}<br>
                         <strong>Dernière étude :</strong> ${lastSurvey}<br>
                       </div>`;

        infowindow.setContent(content);
        infowindow.setPosition(event.latLng);
        infowindow.open(map);

        updateGlacierInfo(name, area, lastSurvey);
    });

    infowindow.addListener("closeclick", () => {
        resetGlacierColors();
        updateGlacierInfo(null, "", "");
    });

    // Recherche et centrage sur un glacier sélectionné
    d3.select("#searchButton").on("click", () => {
        let query = d3.select("#searchBox").property("value").trim().toLowerCase();

        if (query in glacierLocations) {
            resetGlacierColors();

            selectedFeature = null;
            glacierLayer.forEach(feature => {
                if (feature.getProperty("glac_name").toLowerCase() === query) {
                    selectedFeature = feature;
                }
            });

            if (selectedFeature) {
                glacierLayer.overrideStyle(selectedFeature, {
                    fillColor: "red",
                    strokeColor: "red",
                    strokeWeight: 2
                });

                let position = glacierLocations[query];

                console.log("Query:", query);
                console.log("Glacier Location:", glacierLocations[query]);
                console.log("Glacier Locations :", glacierLocations)

                map.setCenter(position);
                map.setZoom(11); 

                let name = selectedFeature.getProperty("glac_name") || "Inconnu";
                let area = selectedFeature.getProperty("db_area") ? selectedFeature.getProperty("db_area").toFixed(2) + " km²" : "Non renseigné";
                let lastSurvey = selectedFeature.getProperty("src_date") || "Date inconnue";

                let content = `<div>
                                <strong>Glacier :</strong> ${name}<br>
                                <strong>Superficie :</strong> ${area}<br>
                                <strong>Dernière étude :</strong> ${lastSurvey}<br>
                            </div>`;

                infowindow.setContent(content);
                infowindow.setPosition(position);
                infowindow.open(map);

                updateGlacierInfo(name, area, lastSurvey);
            } else {
                alert("Erreur : Impossible de récupérer les informations du glacier.");
            }
        } else {
            alert("Glacier non trouvé.");
        }
    });
}

function resetGlacierColors() {
    glacierLayer.revertStyle();
}

function updateGlacierInfo(name, area, date) {
    let infoBox = d3.select("#glacier-info");
    let mapDiv = d3.select("#map");

    if (name) {
        d3.select("#info-name").text(`Glacier : ${name}`);
        d3.select("#info-area").text(`Superficie : ${area}`);
        d3.select("#info-date").text(`Date de relevé : ${date}`);
        
        infoBox.classed("show-info", true);
        mapDiv.classed("map-reduced", true);
    } else {
        infoBox.classed("show-info", false);
        mapDiv.classed("map-reduced", false);
    }
}

// Fonction de filtrage 
function filterBySize() {
    let minSize = parseFloat(d3.select("#size-min").property("value"));
    let maxSize = parseFloat(d3.select("#size-max").property("value"));

    if (minSize > maxSize) {
        [minSize, maxSize] = [maxSize, minSize];
    }

    d3.select("#size-display").text(`${minSize.toFixed(1)} km² - ${maxSize.toFixed(1)} km²`);

    glacierLayer.setStyle(feature => {
        let area = feature.getProperty("db_area");
        return (area !== null && area >= minSize && area <= maxSize) 
            ? { fillColor: "blue", strokeColor: "black", strokeWeight: 1, fillOpacity: 0.5 } 
            : { visible: false };
    });
}

window.initMap = initMap;