let map;
let infowindow;
let glacierLayer; 
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
        center: { lat: 45.9237, lng: 6.8694 },
        zoom: 7,
        mapTypeId: "satellite",
    });

    infowindow = new google.maps.InfoWindow();
    glacierLayer = new google.maps.Data();
    glacierLayer.setMap(map);

    // Get slider and display elements
    const slider = document.getElementById("year-slider");
    const display = document.getElementById("year-display");

    // Update the year display dynamically
    slider.addEventListener("input", function () {
        display.textContent = this.value;
});
    

    d3.json("filtered_glims_alpines_recents_f.geojson").then(data => {
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

    // Gestion du toggle pour l'image de vélocité
    d3.select("#toggle-velocity").on("change", function() {
        if (this.checked) {
            if (!velocityOverlay) {

                const imageBounds = {
                    north: 47.612951,
                    south: 44.701317,
                    east: 13.601868,
                    west: 5.945968,
                  };

                const original_Bounds = {
                    north:  47.506951 ,
                    south: 44.695317,
                    east: 13.681868,
                    west: 6.025968,
                };

                const imageURL = "velocite_t2p.png";  

                velocityOverlay = new google.maps.GroundOverlay(imageURL, imageBounds);
            }
            velocityOverlay.setMap(map);  

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

                map.setCenter(position);
                map.setZoom(11); 

                let name = selectedFeature.getProperty("glac_name") || "Inconnu";
                let area = selectedFeature.getProperty("db_area") ? selectedFeature.getProperty("db_area").toFixed(2) + " km²" : "Non renseigné";
                let lastSurvey = formatDate(selectedFeature.getProperty("src_date"));

                let content = `<div>
                                <strong>Glacier :</strong> ${name}<br>
                                <strong>Superficie :</strong> ${area}<br>
                                <strong>Dernière étude :</strong> ${lastSurvey}<br>
                            </div>`;

                infowindow.setContent(content);
                infowindow.setPosition(position);
                infowindow.open(map);
                
                console.log("searching")
                updateGlacierInfo(name, area, lastSurvey, selectedFeature.getProperty("glac_id"));
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

function loadGlacierData() {
    d3.json("glaciers_areas.json").then(data => {
        glacierData = data;

        // Calculer la moyenne globale
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

        // Moyenne des glaciers à chaque date
        globalAverage = Object.keys(allDates).map(date => ({
            date: date,
            db_area: allDates[date].sum / allDates[date].count
        }));
    });
}

function updateGlacierInfo(name, area, date, glacierId = null) {
    let infoBox = d3.select("#glacier-info");
    let mapDiv = d3.select("#map");

    console.log(glacierId)

    if (name) {
        d3.select("#info-name").text(`Glacier : ${name}`);
        d3.select("#info-area").text(`Superficie : ${area}`);
        d3.select("#info-date").text(`Date de relevé : ${date}`);

        infoBox.classed("show-info", true);
        mapDiv.classed("map-reduced", true);

        if (glacierId) {
            drawGlacierChart(glacierId, name);
        }

    } else {
        infoBox.classed("show-info", false);
        mapDiv.classed("map-reduced", false);

        d3.select("#glacier-chart").selectAll("*").remove();
    }
}


function drawGlacierChart(glacierId, name, startDate = null, endDate = null) {
    const margin = { top: 30, right: document.getElementById("glacier-info").clientWidth / 2, bottom: 40, left: 50 }; 
    const width = document.getElementById("glacier-info").clientWidth - margin.left - margin.right;
    const height = 100 - margin.top - margin.bottom;

    const totalHeight = height + margin.top + margin.bottom + 20; 

    d3.select("#glacier-chart").selectAll("*").remove();

    const svg = d3.select("#glacier-chart")
        .attr("width", width + margin.left + margin.right)
        .attr("height", totalHeight) 
        .style("min-height", "120px")
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top + 10})`); // Move down for better spacing

    let glacierDataPoints = glacierData[glacierId] || [];

    if (glacierDataPoints.length === 0) {
        console.warn("Aucune donnée trouvée pour ce glacier !");
        return;
    }

    const parseDate = d3.timeParse("%Y-%m-%d");
    glacierDataPoints.forEach(d => {
        if (typeof d.date === "string" && d.date.trim() !== "") {
            d.date = parseDate(d.date);
        }
    });

    glacierDataPoints = glacierDataPoints.filter(d => d.date instanceof Date && !isNaN(d.date));

    if (startDate && endDate) {
        glacierDataPoints = glacierDataPoints.filter(d => d.date >= startDate && d.date <= endDate);
    }

    if (glacierDataPoints.length === 0) {
        console.warn("Aucune donnée dans la plage sélectionnée !");
        return;
    }

    const dateExtent = d3.extent(glacierDataPoints, d => d.date);
    xScale = d3.scaleTime().domain(dateExtent).range([0, width]);

    const yMax = d3.max(glacierDataPoints, d => d.db_area) || 1;
    const yMin = d3.min(glacierDataPoints, d => d.db_area) || 1;

    yScale = d3.scaleLinear().domain([yMin, yMax]).range([height, 0]);

    xAxis = (g) => g
        .attr("class", "x-axis") 
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale).ticks(5));

    yAxis = (g) => g
        .attr("class", "y-axis")
        .call(d3.axisLeft(yScale).ticks(3));

    xGrid = (g) => g.attr("class", "grid-lines").selectAll("line").data(xScale.ticks(5)).join("line")
        .attr("x1", d => xScale(d))
        .attr("x2", d => xScale(d))
        .attr("y1", 0) 
        .attr("y2", height) 
        .attr("stroke", "lightgray") 
        .attr("stroke-opacity", 0.7)
        .attr("stroke-dasharray", "3,3"); 

    yGrid = (g) => g.attr("class", "grid-lines").selectAll("line").data(yScale.ticks(5)).join("line")
        .attr("x1", 0) 
        .attr("x2", width) 
        .attr("y1", d => yScale(d))
        .attr("y2", d => yScale(d))
        .attr("stroke", "lightgray")
        .attr("stroke-opacity", 0.7)
        .attr("stroke-dasharray", "3,3");

    svg.append('g').call(xAxis);
    svg.append('g').call(yAxis);
    
    svg.append('g').call(xGrid);
    svg.append('g').call(yGrid);

    const brush = d3.brushX()
        .extent([[0, 0], [width, height]]) 
        .on("end", brushed);

    svg.append("g").attr("class", "brush").call(brush);

    const lineGlacier = d3.line()
        .x(d => xScale(d.date))
        .y(d => yScale(d.db_area))
        .curve(d3.curveMonotoneX);

    svg.append("path")
        .datum(glacierDataPoints)
        .attr("class", "line")
        .attr("fill", "none")
        .attr("stroke", "blue")
        .attr("stroke-width", 2)
        .attr("d", lineGlacier);

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -15)
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .attr("font-weight", "bold")
        .text(`Évolution de la surface du ${name}`);

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + 35)
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .text("Année");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -40) 
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .text("Surface (km2)");
}


function brushed(event) {
    if (!event.selection) return;
    selectedDomain = event.selection.map(xScale.invert);
}

document.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && selectedDomain && selectedFeature) {
        applyZoom(selectedDomain);
        selectedDomain = null;
    }
});

function applyZoom(domain) {
    const [x0, x1] = domain;

    // ✅ Vérifier si un glacier est sélectionné
    if (!selectedFeature) {
        console.warn("Aucun glacier sélectionné !");
        return;
    }

    const glacierId = selectedFeature.getProperty("glac_id");
    const name = selectedFeature.getProperty("glac_name");

    // ✅ Recharge entièrement le graphique avec la plage de dates sélectionnée
    drawGlacierChart(glacierId, name, x0, x1);
}

function interpolateMissingData(data) {
    let interpolatedData = [];
    let lastKnownValue = null;

    data.forEach((d, i) => {
        if (d.db_area !== null) {
            lastKnownValue = d.db_area; 
        } else if (lastKnownValue !== null) {
            d.db_area = lastKnownValue; 
        }
        interpolatedData.push(d);
    });

    return interpolatedData;
}

function formatDate(isoDate) {
    if (!isoDate) return "Date inconnue"; 

    let date = new Date(isoDate);
    if (isNaN(date.getTime())) return "Date inconnue";

    const moisFrancais = [
        "janvier", "février", "mars", "avril", "mai", "juin",
        "juillet", "août", "septembre", "octobre", "novembre", "décembre"
    ];

    let jour = date.getDate(); 
    let mois = moisFrancais[date.getMonth()]; 
    let annee = date.getFullYear(); 

    return `${jour} ${mois} ${annee}`;
}


window.initMap = initMap;


