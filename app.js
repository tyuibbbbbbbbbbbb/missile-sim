// ===== MISSILE LAUNCH SIMULATOR =====

// קואורדינטות מקור - ישראל (בסיס פלמחים)
const ORIGIN = { lat: 31.8839, lng: 34.6868, name: "ישראל" };

// מצב האפליקציה
const state = {
    selectedTarget: null,
    selectedWarhead: null,
    map: null,
    missileMarker: null,
    pathLine: null,
    trailLine: null,
    targetMarker: null,
    originMarker: null,
    isFlying: false,
    flightInterval: null,
    clockInterval: null,
};

// ===== BOOT SEQUENCE =====
const bootMessages = [
    "מאתחל מערכות...",
    "טוען מודול GPS...",
    "מחבר ללוויינים...",
    "בודק מערכת ניווט...",
    "מאמת הרשאות שיגור...",
    "טוען נתוני מפה...",
    "מערכת מוכנה ✓",
];

function runBootSequence() {
    const bar = document.getElementById("bootBar");
    const status = document.getElementById("bootStatus");
    let step = 0;
    const totalSteps = bootMessages.length;

    const interval = setInterval(() => {
        if (step < totalSteps) {
            status.textContent = bootMessages[step];
            bar.style.width = ((step + 1) / totalSteps * 100) + "%";
            step++;
        } else {
            clearInterval(interval);
            setTimeout(() => {
                document.getElementById("boot-screen").style.opacity = "0";
                setTimeout(() => {
                    document.getElementById("boot-screen").classList.add("hidden");
                    document.getElementById("main-app").classList.remove("hidden");
                    initApp();
                }, 500);
            }, 400);
        }
    }, 500);
}

// ===== INIT APP =====
function initApp() {
    initMap();
    initClock();
    initEventListeners();
}

// ===== MAP =====
function initMap() {
    state.map = L.map("map", {
        center: [29, 45],
        zoom: 5,
        zoomControl: false,
        attributionControl: false,
    });

    // Dark map tiles
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
    }).addTo(state.map);

    L.control.zoom({ position: "topright" }).addTo(state.map);

    // סמן מקור - ישראל
    state.originMarker = L.marker([ORIGIN.lat, ORIGIN.lng], {
        icon: L.divIcon({
            className: "origin-marker-icon",
            html: "🇮🇱",
            iconSize: [30, 30],
            iconAnchor: [15, 15],
        }),
    }).addTo(state.map).bindTooltip("בסיס שיגור - ישראל", {
        permanent: false,
        direction: "top",
    });
}

// ===== CLOCK =====
function initClock() {
    const clockEl = document.getElementById("clock");
    function update() {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString("he-IL", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    }
    update();
    state.clockInterval = setInterval(update, 1000);
}

// ===== EVENT LISTENERS =====
function initEventListeners() {
    // כפתורי יעד
    document.querySelectorAll(".target-btn").forEach(btn => {
        btn.addEventListener("click", () => selectTarget(btn));
    });

    // כפתורי ראש נפץ
    document.querySelectorAll(".warhead-btn").forEach(btn => {
        btn.addEventListener("click", () => selectWarhead(btn));
    });

    // כפתור שיגור
    document.getElementById("launchBtn").addEventListener("click", () => {
        if (!state.isFlying && state.selectedTarget && state.selectedWarhead) {
            showConfirmDialog();
        }
    });

    // אישור שיגור
    document.getElementById("confirmYes").addEventListener("click", () => {
        hideConfirmDialog();
        launchMissile();
    });

    document.getElementById("confirmNo").addEventListener("click", () => {
        hideConfirmDialog();
    });
}

// ===== TARGET SELECTION =====
function selectTarget(btn) {
    if (state.isFlying) return;

    document.querySelectorAll(".target-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    state.selectedTarget = {
        lat: parseFloat(btn.dataset.lat),
        lng: parseFloat(btn.dataset.lng),
        name: btn.dataset.name,
        key: btn.dataset.target,
    };

    // סמן יעד על המפה
    if (state.targetMarker) state.map.removeLayer(state.targetMarker);
    state.targetMarker = L.marker([state.selectedTarget.lat, state.selectedTarget.lng], {
        icon: L.divIcon({
            className: "target-marker-icon",
            html: "🎯",
            iconSize: [35, 35],
            iconAnchor: [17, 17],
        }),
    }).addTo(state.map).bindTooltip(state.selectedTarget.name, {
        permanent: true,
        direction: "top",
        className: "target-tooltip",
    });

    // קו מקור -> יעד (מקווקו)
    if (state.pathLine) state.map.removeLayer(state.pathLine);
    state.pathLine = L.polyline(
        [[ORIGIN.lat, ORIGIN.lng], [state.selectedTarget.lat, state.selectedTarget.lng]],
        { color: "#ef4444", weight: 2, dashArray: "10 8", opacity: 0.5 }
    ).addTo(state.map);

    // מרכוז המפה
    state.map.fitBounds(state.pathLine.getBounds(), { padding: [60, 60] });

    updateMissionInfo();
    updateLaunchButton();
}

// ===== WARHEAD SELECTION =====
function selectWarhead(btn) {
    if (state.isFlying) return;

    document.querySelectorAll(".warhead-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    state.selectedWarhead = {
        type: btn.dataset.warhead,
        power: parseInt(btn.dataset.power),
        name: btn.querySelector(".wh-name").textContent,
        desc: btn.querySelector(".wh-desc").textContent,
    };

    updateMissionInfo();
    updateLaunchButton();
}

// ===== MISSION INFO =====
function updateMissionInfo() {
    const section = document.getElementById("missionInfo");

    if (state.selectedTarget) {
        section.classList.remove("hidden");
        document.getElementById("infoTarget").textContent = state.selectedTarget.name;

        const dist = calculateDistance(
            ORIGIN.lat, ORIGIN.lng,
            state.selectedTarget.lat, state.selectedTarget.lng
        );
        document.getElementById("infoDistance").textContent = Math.round(dist) + " ק\"מ";

        // זמן טיסה אקראי 5-7 דקות
        const flightSeconds = getRandomFlightTime();
        const mins = Math.floor(flightSeconds / 60);
        const secs = flightSeconds % 60;
        document.getElementById("infoETA").textContent =
            `${mins}:${secs.toString().padStart(2, "0")} דקות`;

        // שמירת זמן הטיסה
        state.flightDuration = flightSeconds;
    }

    if (state.selectedWarhead) {
        document.getElementById("infoWarhead").textContent = state.selectedWarhead.name;
    }
}

function updateLaunchButton() {
    const btn = document.getElementById("launchBtn");
    const hint = document.getElementById("launchHint");

    if (state.selectedTarget && state.selectedWarhead) {
        btn.classList.remove("disabled");
        btn.disabled = false;
        hint.textContent = `לחץ לשיגור טיל לעבר ${state.selectedTarget.name}`;
        hint.style.color = "#ef4444";
    } else if (!state.selectedTarget) {
        hint.textContent = "בחר יעד כדי להמשיך";
    } else {
        hint.textContent = "בחר ראש נפץ כדי להמשיך";
    }
}

// ===== CONFIRM DIALOG =====
let confirmInterval = null;

function showConfirmDialog() {
    const overlay = document.getElementById("confirmOverlay");
    overlay.classList.remove("hidden");

    document.getElementById("confirmText").innerHTML =
        `האם לשגר טיל מסוג <strong>${state.selectedWarhead.name}</strong><br>` +
        `לעבר <strong>${state.selectedTarget.name}</strong>?`;

    let countdown = 10;
    const countdownEl = document.getElementById("confirmCountdown");
    countdownEl.textContent = countdown;

    confirmInterval = setInterval(() => {
        countdown--;
        countdownEl.textContent = countdown;
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

// ===== LAUNCH MISSILE =====
function launchMissile() {
    state.isFlying = true;

    // נעילת כפתורים
    document.getElementById("launchBtn").classList.add("disabled");
    document.getElementById("launchBtn").disabled = true;
    document.getElementById("launchHint").textContent = "🚀 טיל בטיסה...";
    document.getElementById("launchHint").style.color = "#06b6d4";

    // הכנת נתוני טיסה
    const totalSeconds = state.flightDuration;
    const startLat = ORIGIN.lat;
    const startLng = ORIGIN.lng;
    const endLat = state.selectedTarget.lat;
    const endLng = state.selectedTarget.lng;

    // הצגת שכבת טיסה
    const flightOverlay = document.getElementById("flightOverlay");
    flightOverlay.classList.remove("hidden");
    document.getElementById("flightTarget").textContent = state.selectedTarget.name;

    const totalMins = Math.floor(totalSeconds / 60);
    const totalSecs = totalSeconds % 60;
    document.getElementById("flightETA").textContent =
        `${totalMins}:${totalSecs.toString().padStart(2, "0")}`;

    // סמן טיל
    state.missileMarker = L.marker([startLat, startLng], {
        icon: L.divIcon({
            className: "missile-marker",
            html: "🚀",
            iconSize: [30, 30],
            iconAnchor: [15, 15],
        }),
        zIndexOffset: 1000,
    }).addTo(state.map);

    // קו שובל
    const trailCoords = [[startLat, startLng]];
    state.trailLine = L.polyline(trailCoords, {
        color: "#f97316",
        weight: 3,
        opacity: 0.7,
    }).addTo(state.map);

    // הסרת קו מקווקו
    if (state.pathLine) state.map.removeLayer(state.pathLine);

    // התחלת טיסה
    const startTime = Date.now();
    const totalMs = totalSeconds * 1000;
    let lastTrailUpdate = 0;

    function animateFlight() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / totalMs, 1);

        // חישוב מיקום נוכחי (Great circle interpolation)
        const currentLat = startLat + (endLat - startLat) * easeInOutCubic(progress);
        const currentLng = startLng + (endLng - startLng) * easeInOutCubic(progress);

        // עדכון סמן הטיל
        state.missileMarker.setLatLng([currentLat, currentLng]);

        // סיבוב הטיל לכיוון היעד
        const angle = calculateBearing(currentLat, currentLng, endLat, endLng);
        const iconHtml = `<span style="display:inline-block;transform:rotate(${angle - 45}deg)">🚀</span>`;
        state.missileMarker.setIcon(L.divIcon({
            className: "missile-marker",
            html: iconHtml,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
        }));

        // עדכון שובל
        if (elapsed - lastTrailUpdate > 500) {
            trailCoords.push([currentLat, currentLng]);
            state.trailLine.setLatLngs(trailCoords);
            lastTrailUpdate = elapsed;
        }

        // עדכון טיימר
        const remaining = Math.max(0, totalSeconds - Math.floor(elapsed / 1000));
        const remMins = Math.floor(remaining / 60);
        const remSecs = remaining % 60;
        document.getElementById("flightTimer").textContent =
            `${remMins.toString().padStart(2, "0")}:${remSecs.toString().padStart(2, "0")}`;

        // עדכון progress bar
        document.getElementById("flightProgress").style.width = (progress * 100) + "%";

        // עדכון ETA
        document.getElementById("flightETA").textContent =
            `${remMins}:${remSecs.toString().padStart(2, "0")}`;

        // מרכוז מפה (לאט)
        if (Math.floor(elapsed / 3000) !== Math.floor((elapsed - 16) / 3000)) {
            state.map.panTo([currentLat, currentLng], { animate: true, duration: 2 });
        }

        if (progress < 1) {
            state.flightInterval = requestAnimationFrame(animateFlight);
        } else {
            // הגענו ליעד!
            onMissileArrived();
        }
    }

    state.flightInterval = requestAnimationFrame(animateFlight);
}

// ===== MISSILE ARRIVED =====
function onMissileArrived() {
    state.isFlying = false;

    // הסרת שכבת טיסה
    document.getElementById("flightOverlay").classList.add("hidden");

    // הסרת סמן טיל
    if (state.missileMarker) state.map.removeLayer(state.missileMarker);

    // מרכוז על היעד
    state.map.setView([state.selectedTarget.lat, state.selectedTarget.lng], 8, {
        animate: true,
        duration: 1,
    });

    // סמן פיצוץ על המפה
    const explosionMarker = L.marker(
        [state.selectedTarget.lat, state.selectedTarget.lng],
        {
            icon: L.divIcon({
                className: "explosion-marker",
                html: "💥",
                iconSize: [60, 60],
                iconAnchor: [30, 30],
            }),
            zIndexOffset: 2000,
        }
    ).addTo(state.map);

    // עיגולי פיצוץ על המפה
    const blastCircles = [];
    const radii = [5000, 15000, 30000];
    const colors = ["#ff0000", "#ff6600", "#ffaa00"];
    radii.forEach((r, i) => {
        setTimeout(() => {
            const circle = L.circle(
                [state.selectedTarget.lat, state.selectedTarget.lng],
                {
                    radius: r * state.selectedWarhead.power,
                    color: colors[i],
                    fillColor: colors[i],
                    fillOpacity: 0.2,
                    weight: 2,
                }
            ).addTo(state.map);
            blastCircles.push(circle);
        }, i * 400);
    });

    // שכבת פיצוץ
    const explosionOverlay = document.getElementById("explosionOverlay");
    explosionOverlay.classList.remove("hidden");
    document.getElementById("explosionDetails").innerHTML =
        `טיל ${state.selectedWarhead.name} פגע ב-${state.selectedTarget.name}<br>` +
        `ראש נפץ: ${state.selectedWarhead.desc}`;

    // הסתרת פיצוץ אחרי 6 שניות ואיפוס
    setTimeout(() => {
        explosionOverlay.classList.add("hidden");

        // ניקוי
        setTimeout(() => {
            if (state.trailLine) state.map.removeLayer(state.trailLine);
            state.map.removeLayer(explosionMarker);
            blastCircles.forEach(c => state.map.removeLayer(c));
            if (state.targetMarker) state.map.removeLayer(state.targetMarker);

            // איפוס מצב
            resetState();
        }, 1000);
    }, 6000);
}

// ===== RESET =====
function resetState() {
    state.selectedTarget = null;
    state.selectedWarhead = null;
    state.isFlying = false;

    document.querySelectorAll(".target-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".warhead-btn").forEach(b => b.classList.remove("active"));
    document.getElementById("missionInfo").classList.add("hidden");

    const btn = document.getElementById("launchBtn");
    btn.classList.add("disabled");
    btn.disabled = true;
    document.getElementById("launchHint").textContent = "בחר יעד וראש נפץ כדי לשגר";
    document.getElementById("launchHint").style.color = "";

    // חזרה למבט כללי
    state.map.setView([29, 45], 5, { animate: true, duration: 1.5 });
}

// ===== UTILITY FUNCTIONS =====

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function calculateBearing(lat1, lng1, lat2, lng2) {
    const dLng = toRad(lng2 - lng1);
    const y = Math.sin(dLng) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
        Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function toRad(deg) { return deg * Math.PI / 180; }
function toDeg(rad) { return rad * 180 / Math.PI; }

function easeInOutCubic(t) {
    return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function getRandomFlightTime() {
    // 5-7 דקות בשניות (300-420)
    return Math.floor(Math.random() * (420 - 300 + 1)) + 300;
}

// ===== START =====
document.addEventListener("DOMContentLoaded", runBootSequence);
