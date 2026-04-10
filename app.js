// ===== MISSILE LAUNCH SIMULATOR (Google Maps) =====

var ORIGIN = { lat: 31.8839, lng: 34.6868 };

// Israel bounding box for blocking
var ISRAEL_BOUNDS = {
    north: 33.35,
    south: 29.45,
    west: 34.25,
    east: 35.90
};

var state = {
    selectedTarget: null,
    selectedWarhead: null,
    map: null,
    targetMarker: null,
    originMarker: null,
    pathLine: null,
    missileMarker: null,
    trailLine: null,
    blastCircles: [],
    isFlying: false,
    flightDuration: 0,
    animFrameId: null
};

// ===== BOOT =====
var bootMessages = [
    "Initializing systems...",
    "Loading GPS module...",
    "Connecting to satellites...",
    "Checking navigation...",
    "Verifying launch auth...",
    "Loading map data...",
    "System ready"
];

function runBootSequence() {
    var bar = document.getElementById("bootBar");
    var status = document.getElementById("bootStatus");
    var step = 0;
    var total = bootMessages.length;

    var iv = setInterval(function() {
        if (step < total) {
            status.textContent = bootMessages[step];
            bar.style.width = ((step + 1) / total * 100) + "%";
            step++;
        } else {
            clearInterval(iv);
            setTimeout(function() {
                document.getElementById("boot-screen").style.opacity = "0";
                setTimeout(function() {
                    document.getElementById("boot-screen").classList.add("hidden");
                    document.getElementById("main-app").classList.remove("hidden");
                    initApp();
                }, 500);
            }, 400);
        }
    }, 500);
}

// ===== INIT =====
function initApp() {
    initMap();
    initClock();
    initEventListeners();
}

// ===== MAP =====
function initMap() {
    state.map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 29, lng: 45 },
        zoom: 5,
        mapTypeId: google.maps.MapTypeId.SATELLITE,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: false,
        styles: []
    });

    // Origin marker - Israel
    state.originMarker = new google.maps.Marker({
        position: ORIGIN,
        map: state.map,
        title: "Launch Base - Israel",
        icon: {
            url: "data:image/svg+xml," + encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">' +
                '<circle cx="20" cy="20" r="18" fill="#22c55e" fill-opacity="0.3" stroke="#22c55e" stroke-width="2"/>' +
                '<text x="20" y="26" text-anchor="middle" font-size="18">&#x1F1EE;&#x1F1F1;</text>' +
                '</svg>'
            ),
            scaledSize: new google.maps.Size(40, 40),
            anchor: new google.maps.Point(20, 20)
        },
        zIndex: 100
    });

    // Click on map to select target
    state.map.addListener("click", function(e) {
        if (state.isFlying) return;
        handleMapClick(e.latLng);
    });
}

// ===== CHECK IF IN ISRAEL =====
function isInIsrael(lat, lng) {
    return lat >= ISRAEL_BOUNDS.south && lat <= ISRAEL_BOUNDS.north &&
           lng >= ISRAEL_BOUNDS.west && lng <= ISRAEL_BOUNDS.east;
}

function showIsraelWarning() {
    var el = document.getElementById("israelWarning");
    el.classList.remove("hidden");
    setTimeout(function() {
        el.classList.add("hidden");
    }, 2500);
}

// ===== MAP CLICK =====
function handleMapClick(latLng) {
    var lat = latLng.lat();
    var lng = latLng.lng();

    // Block Israel
    if (isInIsrael(lat, lng)) {
        showIsraelWarning();
        return;
    }

    state.selectedTarget = {
        lat: lat,
        lng: lng,
        name: "Loading..."
    };

    // Place target marker
    if (state.targetMarker) {
        state.targetMarker.setPosition(latLng);
    } else {
        state.targetMarker = new google.maps.Marker({
            position: latLng,
            map: state.map,
            icon: {
                url: "data:image/svg+xml," + encodeURIComponent(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">' +
                    '<circle cx="22" cy="22" r="20" fill="#ef4444" fill-opacity="0.2" stroke="#ef4444" stroke-width="2">' +
                    '<animate attributeName="r" values="14;20;14" dur="2s" repeatCount="indefinite"/>' +
                    '<animate attributeName="fill-opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite"/>' +
                    '</circle>' +
                    '<circle cx="22" cy="22" r="5" fill="#ef4444"/>' +
                    '<line x1="22" y1="2" x2="22" y2="42" stroke="#ef4444" stroke-width="1" opacity="0.5"/>' +
                    '<line x1="2" y1="22" x2="42" y2="22" stroke="#ef4444" stroke-width="1" opacity="0.5"/>' +
                    '</svg>'
                ),
                scaledSize: new google.maps.Size(44, 44),
                anchor: new google.maps.Point(22, 22)
            },
            zIndex: 200
        });
    }

    // Draw path line
    if (state.pathLine) state.pathLine.setMap(null);
    state.pathLine = new google.maps.Polyline({
        path: [ORIGIN, { lat: lat, lng: lng }],
        strokeColor: "#ef4444",
        strokeOpacity: 0.5,
        strokeWeight: 2,
        geodesic: true,
        icons: [{
            icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 },
            offset: "0",
            repeat: "20px"
        }],
        map: state.map
    });

    // Reverse geocode
    var geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: latLng }, function(results, geoStatus) {
        var name = lat.toFixed(4) + ", " + lng.toFixed(4);
        if (geoStatus === "OK" && results && results.length > 0) {
            // Try to find a country or city name
            for (var i = 0; i < results.length; i++) {
                var r = results[i];
                for (var j = 0; j < r.types.length; j++) {
                    if (r.types[j] === "country" || r.types[j] === "administrative_area_level_1") {
                        name = r.formatted_address;
                        break;
                    }
                }
            }
            if (name === lat.toFixed(4) + ", " + lng.toFixed(4) && results[0]) {
                name = results[0].formatted_address;
            }
        }
        state.selectedTarget.name = name;
        document.getElementById("infoTarget").textContent = name;
    });

    // Update info
    document.getElementById("infoCoords").textContent = lat.toFixed(4) + ", " + lng.toFixed(4);

    var dist = calculateDistance(ORIGIN.lat, ORIGIN.lng, lat, lng);
    document.getElementById("infoDistance").textContent = Math.round(dist) + " km";

    // Flight time 5-7 min
    state.flightDuration = getRandomFlightTime();
    var mins = Math.floor(state.flightDuration / 60);
    var secs = state.flightDuration % 60;

    document.getElementById("missionInfo").classList.remove("hidden");
    document.getElementById("infoETA").textContent = mins + ":" + padZero(secs);

    updateLaunchButton();
}

// ===== CLOCK =====
function initClock() {
    var el = document.getElementById("clock");
    function update() {
        var now = new Date();
        el.textContent = padZero(now.getHours()) + ":" + padZero(now.getMinutes()) + ":" + padZero(now.getSeconds());
    }
    update();
    setInterval(update, 1000);
}

// ===== EVENT LISTENERS =====
function initEventListeners() {
    var warheadBtns = document.querySelectorAll(".warhead-btn");
    for (var i = 0; i < warheadBtns.length; i++) {
        (function(btn) {
            btn.addEventListener("click", function() { selectWarhead(btn); });
        })(warheadBtns[i]);
    }

    document.getElementById("launchBtn").addEventListener("click", function() {
        if (!state.isFlying && state.selectedTarget && state.selectedWarhead) {
            showConfirmDialog();
        }
    });

    document.getElementById("confirmYes").addEventListener("click", function() {
        hideConfirmDialog();
        launchMissile();
    });

    document.getElementById("confirmNo").addEventListener("click", function() {
        hideConfirmDialog();
    });
}

// ===== WARHEAD =====
function selectWarhead(btn) {
    if (state.isFlying) return;
    var all = document.querySelectorAll(".warhead-btn");
    for (var i = 0; i < all.length; i++) all[i].classList.remove("active");
    btn.classList.add("active");

    state.selectedWarhead = {
        type: btn.getAttribute("data-warhead"),
        power: parseInt(btn.getAttribute("data-power")),
        name: btn.querySelector(".wh-name").textContent,
        desc: btn.querySelector(".wh-desc").textContent
    };

    document.getElementById("infoWarhead").textContent = state.selectedWarhead.name;
    document.getElementById("missionInfo").classList.remove("hidden");
    updateLaunchButton();
}

function updateLaunchButton() {
    var btn = document.getElementById("launchBtn");
    var hint = document.getElementById("launchHint");
    if (state.selectedTarget && state.selectedWarhead) {
        btn.classList.remove("disabled");
        btn.disabled = false;
        hint.textContent = "Ready to launch";
        hint.style.color = "#ef4444";
    } else if (!state.selectedTarget) {
        hint.textContent = "Click on map to select target";
    } else {
        hint.textContent = "Select warhead to continue";
    }
}

// ===== CONFIRM =====
var confirmInterval = null;

function showConfirmDialog() {
    document.getElementById("confirmOverlay").classList.remove("hidden");
    document.getElementById("confirmText").innerHTML =
        "Launch <strong>" + state.selectedWarhead.name + "</strong> missile<br>" +
        "to <strong>" + state.selectedTarget.name + "</strong>?";

    var countdown = 10;
    var el = document.getElementById("confirmCountdown");
    el.textContent = countdown;
    confirmInterval = setInterval(function() {
        countdown--;
        el.textContent = countdown;
        if (countdown <= 0) {
            clearInterval(confirmInterval);
            hideConfirmDialog();
        }
    }, 1000);
}

function hideConfirmDialog() {
    if (confirmInterval) clearInterval(confirmInterval);
    document.getElementById("confirmOverlay").classList.add("hidden");
}

// ===== LAUNCH =====
function launchMissile() {
    state.isFlying = true;

    var btn = document.getElementById("launchBtn");
    btn.classList.add("disabled");
    btn.disabled = true;
    document.getElementById("launchHint").textContent = "MISSILE IN FLIGHT...";
    document.getElementById("launchHint").style.color = "#06b6d4";

    var totalSec = state.flightDuration;
    var startPos = new google.maps.LatLng(ORIGIN.lat, ORIGIN.lng);
    var endPos = new google.maps.LatLng(state.selectedTarget.lat, state.selectedTarget.lng);

    // Show flight overlay
    document.getElementById("flightOverlay").classList.remove("hidden");
    document.getElementById("flightTarget").textContent = state.selectedTarget.name;
    document.getElementById("flightETA").textContent =
        Math.floor(totalSec / 60) + ":" + padZero(totalSec % 60);

    // Remove dashed path
    if (state.pathLine) { state.pathLine.setMap(null); state.pathLine = null; }

    // Missile marker
    state.missileMarker = new google.maps.Marker({
        position: startPos,
        map: state.map,
        icon: {
            url: "data:image/svg+xml," + encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">' +
                '<text x="18" y="26" text-anchor="middle" font-size="24">&#x1F680;</text>' +
                '</svg>'
            ),
            scaledSize: new google.maps.Size(36, 36),
            anchor: new google.maps.Point(18, 18)
        },
        zIndex: 500
    });

    // Trail
    var trailPath = [startPos];
    state.trailLine = new google.maps.Polyline({
        path: trailPath,
        strokeColor: "#f97316",
        strokeOpacity: 0.7,
        strokeWeight: 3,
        geodesic: true,
        map: state.map
    });

    // Fit bounds to see whole path
    var bounds = new google.maps.LatLngBounds();
    bounds.extend(startPos);
    bounds.extend(endPos);
    state.map.fitBounds(bounds, 60);

    var startTime = Date.now();
    var totalMs = totalSec * 1000;
    var lastTrail = 0;

    function animate() {
        var elapsed = Date.now() - startTime;
        var progress = Math.min(elapsed / totalMs, 1);
        var ease = easeInOutCubic(progress);

        var curLat = ORIGIN.lat + (state.selectedTarget.lat - ORIGIN.lat) * ease;
        var curLng = ORIGIN.lng + (state.selectedTarget.lng - ORIGIN.lng) * ease;
        var pos = new google.maps.LatLng(curLat, curLng);

        state.missileMarker.setPosition(pos);

        // Trail update
        if (elapsed - lastTrail > 500) {
            trailPath.push(pos);
            state.trailLine.setPath(trailPath);
            lastTrail = elapsed;
        }

        // Timer
        var remain = Math.max(0, totalSec - Math.floor(elapsed / 1000));
        document.getElementById("flightTimer").textContent =
            padZero(Math.floor(remain / 60)) + ":" + padZero(remain % 60);
        document.getElementById("flightProgress").style.width = (progress * 100) + "%";
        document.getElementById("flightETA").textContent =
            Math.floor(remain / 60) + ":" + padZero(remain % 60);

        // Pan map slowly
        if (Math.floor(elapsed / 5000) !== Math.floor((elapsed - 16) / 5000)) {
            state.map.panTo(pos);
        }

        if (progress < 1) {
            state.animFrameId = requestAnimationFrame(animate);
        } else {
            onMissileArrived();
        }
    }

    state.animFrameId = requestAnimationFrame(animate);
}

// ===== ARRIVED =====
function onMissileArrived() {
    state.isFlying = false;
    document.getElementById("flightOverlay").classList.add("hidden");

    // Remove missile
    if (state.missileMarker) { state.missileMarker.setMap(null); state.missileMarker = null; }

    // Zoom to target
    state.map.setCenter({ lat: state.selectedTarget.lat, lng: state.selectedTarget.lng });
    state.map.setZoom(8);

    // Blast circles
    var radii = [5000, 15000, 30000];
    var colors = ["#ff0000", "#ff6600", "#ffaa00"];
    state.blastCircles = [];
    for (var i = 0; i < radii.length; i++) {
        (function(idx) {
            setTimeout(function() {
                var c = new google.maps.Circle({
                    center: { lat: state.selectedTarget.lat, lng: state.selectedTarget.lng },
                    radius: radii[idx] * state.selectedWarhead.power,
                    strokeColor: colors[idx],
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                    fillColor: colors[idx],
                    fillOpacity: 0.15,
                    map: state.map
                });
                state.blastCircles.push(c);
            }, idx * 400);
        })(i);
    }

    // Explosion overlay
    document.getElementById("explosionOverlay").classList.remove("hidden");
    document.getElementById("explosionDetails").innerHTML =
        state.selectedWarhead.name + " hit " + state.selectedTarget.name + "<br>" +
        "Warhead: " + state.selectedWarhead.desc;

    // Reset after 6s
    setTimeout(function() {
        document.getElementById("explosionOverlay").classList.add("hidden");
        setTimeout(function() {
            cleanup();
            resetState();
        }, 1000);
    }, 6000);
}

// ===== CLEANUP =====
function cleanup() {
    if (state.trailLine) { state.trailLine.setMap(null); state.trailLine = null; }
    if (state.targetMarker) { state.targetMarker.setMap(null); state.targetMarker = null; }
    if (state.pathLine) { state.pathLine.setMap(null); state.pathLine = null; }
    for (var i = 0; i < state.blastCircles.length; i++) {
        state.blastCircles[i].setMap(null);
    }
    state.blastCircles = [];
}

// ===== RESET =====
function resetState() {
    state.selectedTarget = null;
    state.selectedWarhead = null;
    state.isFlying = false;

    var all = document.querySelectorAll(".warhead-btn");
    for (var i = 0; i < all.length; i++) all[i].classList.remove("active");

    document.getElementById("missionInfo").classList.add("hidden");
    document.getElementById("infoCoords").textContent = "-";
    document.getElementById("infoTarget").textContent = "-";
    document.getElementById("infoDistance").textContent = "-";

    var btn = document.getElementById("launchBtn");
    btn.classList.add("disabled");
    btn.disabled = true;
    document.getElementById("launchHint").textContent = "Select target and warhead to launch";
    document.getElementById("launchHint").style.color = "";

    state.map.setCenter({ lat: 29, lng: 45 });
    state.map.setZoom(5);
}

// ===== UTILS =====
function calculateDistance(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(d) { return d * Math.PI / 180; }

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function getRandomFlightTime() {
    return Math.floor(Math.random() * (420 - 300 + 1)) + 300;
}

function padZero(n) { return n < 10 ? "0" + n : "" + n; }

// ===== START =====
document.addEventListener("DOMContentLoaded", runBootSequence);
