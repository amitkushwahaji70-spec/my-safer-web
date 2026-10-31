// =====================================
// SAFER SAMAN BOOKING SYSTEM
// =====================================

const RATE_PER_KM = 15;

const ORS_BASE_URL = "https://api.heigit.org";
const ORS_API_BASE_URL = "https://api.openrouteservice.org";

let currentAddress = "";
let currentLat = null;
let currentLng = null;
let currentBooking = null;
let destinationSuggestTimer = null;
let destinationSuggestController = null;
let pendingWhatsAppWindow = null;

// =====================================
// PAGE LOAD
// =====================================

window.addEventListener("load", () => {
    console.log("SAFER SAMAN loaded");

    initializeVoiceSearch();
    initializeDestinationInput();
    bindButtons();

    // Existing current-location behavior retained
    detectLocation();
});

// =====================================
// DETECT CURRENT LOCATION
// Existing location flow retained
// =====================================

const LOCATIONIQ_API_KEY = "pk.4c006a5c294e6ea44c55d0f1fa4b0226";

function detectLocation(sendToWhatsApp = false) {
    if (!navigator.geolocation) {
        alert("Your browser does not support location.");
        return;
    }

    console.log("Requesting current location...");

    navigator.geolocation.getCurrentPosition(
        position => successLocation(position, sendToWhatsApp),
        handleLocationError,
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        }
    );
}

async function successLocation(position, sendToWhatsApp = false) {
    currentLat = position.coords.latitude;
    currentLng = position.coords.longitude;

    const accuracy = position.coords.accuracy;

    console.log(
        `GPS Lat/Lng: ${currentLat}, ${currentLng} (Accuracy: ${accuracy}m)`
    );

    const pickupInput = document.getElementById("pickup");

    if (pickupInput) {
        pickupInput.value = "सटीक एड्रेस डिटेक्ट हो रहा है...";
    }

    try {
        const url =
            `https://us1.locationiq.com/v1/reverse.php` +
            `?key=${LOCATIONIQ_API_KEY}` +
            `&lat=${currentLat}` +
            `&lon=${currentLng}` +
            `&format=json&accept-language=hi,en`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(
                `LocationIQ failed with status: ${response.status}`
            );
        }

        const data = await response.json();

        if (data && data.display_name) {
            currentAddress = data.display_name;
        } else {
            currentAddress =
                `${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}`;
        }
    } catch (error) {
        console.error("LocationIQ Error:", error);

        currentAddress =
            `${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}`;
    }

    if (pickupInput) {
        pickupInput.value = currentAddress;
    }

    console.log("Input Text Address:", currentAddress);

    if (sendToWhatsApp) {
        await sendCurrentLocationToWhatsApp();
    }
}

function handleLocationError(error) {
    console.error("Location Error:", error);

    switch (error.code) {
        case 1:
            alert(
                "Location permission denied. Please allow location access and try again."
            );
            break;

        case 2:
            alert(
                "Location information is unavailable. Please try again."
            );
            break;

        case 3:
            alert(
                "Location request timed out. Please try again."
            );
            break;

        default:
            alert("Unable to detect your current location.");
    }

    if (pendingWhatsAppWindow && !pendingWhatsAppWindow.closed) {
        pendingWhatsAppWindow.close();
    }

    pendingWhatsAppWindow = null;
}


/* =========================================
   HYBRID LOCATION SEARCH
   ORS first, Photon fallback
========================================= */

function normalizePlaceText(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[.,،؛:()[\]{}]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getPlaceLabel(props = {}) {
    const name = props.name || props.street || "";
    const city =
        props.locality ||
        props.localadmin ||
        props.city ||
        props.town ||
        props.village ||
        "";
    const district =
        props.county ||
        props.district ||
        "";
    const state = props.region || props.state || "";

    const parts = [];

    [name, city, district, state].forEach(value => {
        if (!value) return;

        const clean = String(value).trim();

        if (
            clean &&
            !parts.some(
                old =>
                    normalizePlaceText(old) ===
                    normalizePlaceText(clean)
            )
        ) {
            parts.push(clean);
        }
    });

    return parts.join(", ") || props.label || name;
}

function haversineKm(lat1, lng1, lat2, lng2) {
    const rad = value => value * Math.PI / 180;
    const dLat = rad(lat2 - lat1);
    const dLng = rad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(rad(lat1)) *
        Math.cos(rad(lat2)) *
        Math.sin(dLng / 2) ** 2;

    return 6371 * 2 *
        Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


function rankPlaces(items, query, focus = null) {
    const cleanQuery = normalizePlaceText(query);
    const tokens = cleanQuery.split(/\s+/).filter(Boolean);
    const hasMultipleWords = tokens.length > 1;

    return items.map(item => {
        const props = item.properties || {};
        const label = item.label || getPlaceLabel(props);

        const name = normalizePlaceText(
            [props.name, props.street].filter(Boolean).join(" ")
        );

        const full = normalizePlaceText(label);

        // City, town, village aur district ka context
        const admin = normalizePlaceText([
            props.city,
            props.town,
            props.village,
            props.locality,
            props.localadmin,
            props.county,
            props.district,
            props.state
        ].filter(Boolean).join(" "));

        const coords = item.geometry?.coordinates || [];
        const lng = Number(coords[0]);
        const lat = Number(coords[1]);

        let distanceKm = Infinity;

        if (
            focus &&
            Number.isFinite(lat) &&
            Number.isFinite(lng)
        ) {
            distanceKm = haversineKm(
                focus.lat,
                focus.lng,
                lat,
                lng
            );
        }

        let score = 0;
        let nameMatches = 0;
        let fullMatches = 0;
        let contextMatches = 0;

        tokens.forEach(token => {
            if (name.includes(token)) {
                nameMatches++;
                score += 10;
            } else if (full.includes(token)) {
                fullMatches++;
                score += 5;
            }

            // Multi-word query mein city/town context ko bhi dekhein
            if (hasMultipleWords && admin.includes(token)) {
                contextMatches++;
                score += 8;
            }
        });

        // Query ke saare words result mein milte hon
        if (tokens.length > 0 && tokens.every(
            token => full.includes(token)
        )) {
            score += 15;
        }

        // Ek shabd: pickup ke nazdeek jagah ko strong priority
        if (!hasMultipleWords && Number.isFinite(distanceKm)) {
            score -= distanceKm * 1.5;
        }

        // Multiple words: matching pehle, distance ka effect halka
        if (hasMultipleWords && Number.isFinite(distanceKm)) {
            score -= distanceKm * 0.05;
        }

        return {
            lat,
            lng,
            label,
            score,
            distanceKm,
            nameMatches,
            fullMatches,
            contextMatches
        };
    })
    .filter(item =>
        Number.isFinite(item.lat) &&
        Number.isFinite(item.lng) &&
        item.label
    )
    .sort((a, b) => b.score - a.score);
}



async function searchPlaces(query, focus = null, signal) {
    const cleanQuery = String(query || "").trim();

    if (!cleanQuery) return [];

    const params = new URLSearchParams({
        q: cleanQuery
    });

    const searchFocus = focus || (
        Number.isFinite(currentLat) &&
        Number.isFinite(currentLng)
            ? { lat: currentLat, lng: currentLng }
            : null
    );

    if (searchFocus) {
        params.set("lat", String(searchFocus.lat));
        params.set("lon", String(searchFocus.lng));
    }

    const response = await fetch(
        `/api/search-location?${params.toString()}`,
        signal ? { signal } : undefined
    );

    if (!response.ok) {
        throw new Error(
            `Location search API failed: ${response.status}`
        );
    }

    const data = await response.json();

    if (!data.success || !Array.isArray(data.features)) {
        throw new Error(
            data.message || "Invalid location search response"
        );
    }

    const features = data.features;

    const items = features.map(feature => {
        const props = feature.properties || {};
        const coords = feature.geometry?.coordinates || [];

        const label =
            props.label ||
            [
                props.name,
                props.city || props.town || props.village,
                props.county,
                props.state
            ].filter(Boolean).join(", ");

        return {
            properties: props,
            geometry: feature.geometry,
            label
        };
    });

    return rankPlaces(items, cleanQuery, searchFocus);
}


/* =========================================
   ADDRESS GEOCODING
========================================= */

async function geocodeAddress(address, focus = null) {
    if (!address || !address.trim()) {
        throw new Error("Address is empty.");
    }

    const results = await searchPlaces(address, focus);

    if (!results.length) {
        throw new Error(`Location not found: ${address}`);
    }

    const best = results[0];

    return {
        lat: best.lat,
        lng: best.lng,
        label: best.label
    };
}


/* =========================================
   DESTINATION AUTOCOMPLETE
========================================= */

function initializeDestinationInput() {
    const dropInput = document.getElementById("drop");
    if (!dropInput) return;

    let datalist = document.getElementById("dropSuggestions");

    if (!datalist) {
        datalist = document.createElement("datalist");
        datalist.id = "dropSuggestions";
        document.body.appendChild(datalist);
    }

    dropInput.setAttribute("list", "dropSuggestions");
    dropInput.setAttribute("autocomplete", "off");

    dropInput.addEventListener("input", () => {
        currentBooking = null;

        const confirmation =
            document.getElementById("bookingConfirmation");

        if (confirmation) {
            confirmation.classList.remove("show");
        }

        clearTimeout(destinationSuggestTimer);

        if (destinationSuggestController) {
            destinationSuggestController.abort();
        }

        const query = dropInput.value.trim();

        if (query.length < 2) {
            datalist.replaceChildren();
            return;
        }

        destinationSuggestTimer = setTimeout(async () => {
            const controller = new AbortController();
            destinationSuggestController = controller;

            try {
                const results = await searchPlaces(
                    query,
                    null,
                    controller.signal
                );

                if (controller.signal.aborted) return;

                datalist.replaceChildren();

                const seen = new Set();

                results.forEach(place => {
                    const label = place.label;
                    const key = normalizePlaceText(label);

                    if (!label || seen.has(key)) return;
                    seen.add(key);

                    const option = document.createElement("option");
                    option.value = label;
                    datalist.appendChild(option);
                });
            } catch (error) {
                if (error.name !== "AbortError") {
                    console.error("Place suggestions failed:", error);
                }
            }
        }, 500);
    });
}



// =====================================
// VOICE SEARCH
// =====================================

function initializeVoiceSearch() {
    const micBtn = document.getElementById("micBtn");

    if (!micBtn) return;

    micBtn.addEventListener("click", startVoiceSearch);
}

function startVoiceSearch() {
    const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        alert("Voice search is not supported. Please try Google Chrome.");
        return;
    }

    const micBtn = document.getElementById("micBtn");
    const dropInput = document.getElementById("drop");

    if (!dropInput) {
        alert('Destination input with id="drop" was not found.');
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "hi-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        if (micBtn) {
            micBtn.classList.add("listening");
            micBtn.innerText = "Listening...";
        }
    };

    recognition.onresult = event => {
        const spokenText =
            event.results?.[0]?.[0]?.transcript?.trim();

        if (!spokenText) return;

        dropInput.value = spokenText;
        dropInput.dispatchEvent(new Event("input", { bubbles: true }));

        console.log("Voice destination:", spokenText);
    };

    recognition.onerror = event => {
        console.error("Voice recognition error:", event.error);
        alert("Voice search failed. Please try again.");
    };

    recognition.onend = () => {
        if (micBtn) {
            micBtn.classList.remove("listening");
            micBtn.innerText = "🎤 Start";
        }
    };

    try {
        recognition.start();
    } catch (error) {
        console.error("Could not start voice search:", error);
    }
}

// =====================================
// BUTTON EVENTS
// =====================================

function bindButtons() {
    const bind = (id, event, handler) => {
        const element = document.getElementById(id);

        if (element) {
            element.addEventListener(event, handler);
        }
    };

    bind("locationBtn", "click", () => detectLocation());
    bind("bookBtn", "click", calculateBooking);
    bind("callBtn", "click", makeCall);
    bind("confirmBookingBtn", "click", confirmBooking);
    bind("editBookingBtn", "click", editBooking);
    bind("sendLocationBtn", "click", () => detectLocation(true));
}

// =====================================
// CALCULATE DISTANCE AND FARE
// =====================================

async function calculateBooking() {
    const pickupInput = document.getElementById("pickup");
    const dropInput = document.getElementById("drop");

    const distanceOutput = document.getElementById("distance");
    const fareOutput = document.getElementById("fare");

    if (!pickupInput || !dropInput) {
        console.error('Required inputs "pickup" and "drop" were not found.');
        alert("Booking inputs could not be found. Please check the page.");
        return;
    }

    const pickup = pickupInput.value.trim();
    const drop = dropInput.value.trim();

    if (!pickup || !drop) {
        alert("Please enter your pickup location and destination.");
        return;
    }

    currentBooking = null;

    const confirmation =
        document.getElementById("bookingConfirmation");

    if (confirmation) {
        confirmation.classList.remove("show");
    }

    if (distanceOutput) distanceOutput.innerText = "Calculating...";
    if (fareOutput) fareOutput.innerText = "₹--";

    try { 
        
const pickupWasChanged =
    normalizePlaceText(pickup) !==
    normalizePlaceText(currentAddress);

const pickupLocation = pickupWasChanged
    ? await geocodeAddress(pickup)
    : {
        lat: Number(currentLat),
        lng: Number(currentLng),
        label: currentAddress || pickup
      };


       const dropLocation = await geocodeAddress(drop, {
          lat: pickupLocation.lat,
          lng: pickupLocation.lng
       });

       
        const routeResponse = await fetch("/api/calculate-route", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                start: {
                    lat: pickupLocation.lat,
                    lng: pickupLocation.lng
                },
                end: {
                    lat: dropLocation.lat,
                    lng: dropLocation.lng
                }
            })
        });

        const routeData = await routeResponse.json();

        if (!routeResponse.ok || !routeData.success) {
            throw new Error(
                routeData.error || `Route request failed: ${routeResponse.status}`
            );
        }

        const distanceMeters = routeData.distanceMeters;

        if (typeof distanceMeters !== "number") {
            throw new Error("Route distance was not returned.");
        }


        const distanceKM = distanceMeters / 1000;
        const fare = Math.round(distanceKM * RATE_PER_KM);

        if (distanceOutput) {
            distanceOutput.innerText = `${distanceKM.toFixed(1)} km`;
        }

        if (fareOutput) {
            fareOutput.innerText = `₹${fare}`;
        }

        currentBooking = {
            pickup,
            pickupLabel: pickupLocation.label,
            pickupLat: pickupLocation.lat,
            pickupLng: pickupLocation.lng,
            drop,
            dropLabel: dropLocation.label,
            dropLat: dropLocation.lat,
            dropLng: dropLocation.lng,
            distance: distanceKM,
            fare
        };

        const setText = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.innerText = value;
        };

        setText("confirmPickup", pickupLocation.label);
        setText("confirmDrop", dropLocation.label);
        setText("confirmDistance", `${distanceKM.toFixed(1)} km`);
        setText("confirmFare", `₹${fare}`);

        if (confirmation) {
            confirmation.classList.add("show");
        }

        console.log("BOOKING CALCULATED:", currentBooking);
    } catch (error) {
        console.error("Booking Calculation Error:", error);

        if (distanceOutput) distanceOutput.innerText = "--";
        if (fareOutput) fareOutput.innerText = "₹--";

        alert(
            "Location or route could not be found. Check the addresses and API key."
        );
    }
}

// =====================================
// CONFIRM BOOKING
// =====================================

function confirmBooking() {
    if (!currentBooking) {
        alert("Please calculate your booking first.");
        return;
    }

    const now = new Date();
    const date = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = String(now.getFullYear()).slice(-2);
    const random = Math.floor(1000 + Math.random() * 9000);

    currentBooking.bookingId = `SS${date}${month}${year}-${random}`;
    currentBooking.status = "Pending";

    sendConfirmedBooking(currentBooking);
}

// =====================================
// EDIT BOOKING
// =====================================

function editBooking() {
    const confirmation =
        document.getElementById("bookingConfirmation");

    if (confirmation) {
        confirmation.classList.remove("show");
    }

    const dropInput = document.getElementById("drop");

    if (dropInput) {
        dropInput.focus();
    }
}

// =====================================
// SEND BOOKING DETAILS TO WHATSAPP
// No booking server required
// =====================================

function sendConfirmedBooking(booking) {
    const message = [
        "🚚 SAFER SAMAN - BOOKING REQUEST",
        "",
        `Booking ID: ${booking.bookingId}`,
        `Pickup: ${booking.pickupLabel || booking.pickup}`,
        `Destination: ${booking.dropLabel || booking.drop}`,
        `Distance: ${Number(booking.distance).toFixed(1)} km`,
        `Fare: ₹${booking.fare}`,
        "Status: Pending",
        "",
        "Please confirm this booking."
    ].join("\n");

    const whatsappURL =
        "https://wa.me/917974483199?text=" +
        encodeURIComponent(message);

    window.open(whatsappURL, "_blank");

    alert(
        "Booking details are ready in WhatsApp. Press Send to submit.\n\n" +
        `Booking ID: ${booking.bookingId}`
    );
}

// =====================================
// SEND CURRENT LOCATION TO WHATSAPP
// =====================================

async function sendCurrentLocationToWhatsApp() {
    if (currentLat == null || currentLng == null) {
        console.log("Send Location clicked:", currentLat, currentLng, currentAddress);
        alert("Please detect your current location first.");
        return;
    }

    const mapsLink =
        `https://www.google.com/maps?q=${currentLat},${currentLng}`;

    const message = [
        "🚚 SAFER SAMAN - PICKUP LOCATION",
        "",
        `Pickup Address: ${currentAddress || "Address unavailable"}`,
        `Google Maps: ${mapsLink}`,
        "",
        "Please arrange pickup from this location."
    ].join("\n");

    const whatsappURL =
        "https://wa.me/917974483199?text=" +
        encodeURIComponent(message);

    window.open(whatsappURL, "_blank");
}

// =====================================
// PHONE CALL
// =====================================

function makeCall() {
    window.location.href = "tel:+919244130492";
}
