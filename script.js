// =====================================
// SAFER SAMAN BOOKING SYSTEM
// =====================================

const RATE_PER_KM = 15;
const ORS_API_KEY ="eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjkyNWViMmNhODVkZDQ0MTBiZjE5M2Q3ZWI0YjVjMjQ2IiwiaCI6Im11cm11cjY0In0=";
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
   SMART PLACE SEARCH
   1. Sirf jagah: pickup ke nearest results
   2. City/town mentioned: us city/town aur
      aas-paas ke areas/villages ko priority
   3. Suggestions: place, city/town, district
========================================= */

function normalizePlaceText(value) {
    return String(value || "")
        .toLocaleLowerCase("hi-IN")
        .replace(/[.,،؛:()\[\]{}]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getPlaceAdminText(props = {}) {
    return normalizePlaceText([
        props.locality,
        props.localadmin,
        props.municipality,
        props.borough,
        props.county,
        props.region
    ].filter(Boolean).join(" "));
}

function getPlaceDisplayLabel(props = {}) {
    const name = props.name || props.street || props.label;
    const city =
        props.locality ||
        props.localadmin ||
        props.municipality ||
        props.borough;

    const district = props.county;
    const parts = [];

    [name, city, district].filter(Boolean).forEach(part => {
        const clean = String(part).trim();

        if (
            clean &&
            !parts.some(
                existing =>
                    normalizePlaceText(existing) ===
                    normalizePlaceText(clean)
            )
        ) {
            parts.push(clean);
        }
    });

    // Provider ke paas district na ho to full address rakhein.
    if (!district && props.label) {
        return props.label;
    }

    return parts.length > 1
        ? parts.join(", ")
        : (props.label || name || "");
}

function haversineKm(lat1, lng1, lat2, lng2) {
    const values = [lat1, lng1, lat2, lng2];

    if (!values.every(
        value => typeof value === "number" &&
        Number.isFinite(value)
    )) {
        return Number.POSITIVE_INFINITY;
    }

    const toRad = value => value * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) ** 2;

    return 6371 * 2 *
        Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function rankPlaceFeatures(
    features,
    query,
    focusLocation = null
) {
    const normalizedQuery = normalizePlaceText(query);
    const queryTokens = normalizedQuery.split(" ").filter(Boolean);

    const ranked = (features || []).map(feature => {
        const props = feature.properties || {};

        const nameText = normalizePlaceText([
            props.name,
            props.street
        ].filter(Boolean).join(" "));

        const labelText = normalizePlaceText(
            props.label || props.name || ""
        );

        const adminText = getPlaceAdminText(props);
        const adminTokens = adminText.split(" ").filter(Boolean);

        const nameMatches = queryTokens.filter(
            token => nameText.includes(token)
        ).length;

        const labelMatches = queryTokens.filter(
            token => labelText.includes(token)
        ).length;

        const contextMatches = queryTokens.filter(
            token => token.length >= 3 &&
                adminTokens.some(admin => admin.includes(token))
        ).length;

        const coords = feature.geometry?.coordinates || [];
        const lng = Number(coords[0]);
        const lat = Number(coords[1]);

        const distanceKm = focusLocation
            ? haversineKm(
                focusLocation.lat,
                focusLocation.lng,
                lat,
                lng
            )
            : Number.POSITIVE_INFINITY;

        /*
          Multi-word query mein city/town context ko priority.
          Single/short query mein pickup ke nearest matching places.
        */
        const hasContext = contextMatches > 0;
        let score = nameMatches * 5 + labelMatches * 1.5;

        if (hasContext) {
            score += 22 + contextMatches * 6;
        }

        if (Number.isFinite(distanceKm)) {
            score += hasContext
                ? -distanceKm * 0.02
                : -distanceKm * 0.8;
        }

        if (
            queryTokens.length > 1 &&
            queryTokens.every(token => labelText.includes(token))
        ) {
            score += 5;
        }

        return {
            feature,
            score,
            distanceKm,
            label: getPlaceDisplayLabel(props)
        };
    });

    ranked.sort((a, b) => b.score - a.score);
    return ranked;
}

async function searchPlaceFeatures(
    query,
    focusLocation = null,
    signal = undefined
) {
    const params = new URLSearchParams({
        api_key: ORS_API_KEY,
        text: query,
        "boundary.country": "IND",
        size: "20"
    });

    const focus = focusLocation || (
        typeof currentLat === "number" &&
        typeof currentLng === "number"
            ? { lat: currentLat, lng: currentLng }
            : null
    );

    if (focus) {
        params.set("focus.point.lat", focus.lat);
        params.set("focus.point.lon", focus.lng);
    }

    const response = await fetch(
        `${ORS_API_BASE_URL}/geocode/search?${params.toString()}`,
        signal ? { signal } : undefined
    );

    if (!response.ok) {
        throw new Error(
            `Place search failed: ${response.status}`
        );
    }

    const data = await response.json();

    return rankPlaceFeatures(
        data.features || [],
        query,
        focus
    );
}

async function geocodeAddress(address, focusLocation = null) {
    if (!address || !address.trim()) {
        throw new Error("Address is empty.");
    }

    const results = await searchPlaceFeatures(
        address.trim(),
        focusLocation
    );

    const best = results.find(item =>
        item.feature?.geometry?.coordinates
    );

    if (!best) {
        throw new Error(`Location not found: ${address}`);
    }

    const feature = best.feature;
    const coords = feature.geometry.coordinates;

    return {
        lng: Number(coords[0]),
        lat: Number(coords[1]),
        label:
            best.label ||
            feature.properties?.label ||
            feature.properties?.name ||
            address
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
                const results = await searchPlaceFeatures(
                    query,
                    null,
                    controller.signal
                );

                if (controller.signal.aborted) return;

                datalist.replaceChildren();

                const seen = new Set();

                results.forEach(item => {
                    if (!item.label) return;

                    const normalized =
                        normalizePlaceText(item.label);

                    if (seen.has(normalized)) return;
                    seen.add(normalized);

                    const option = document.createElement("option");
                    option.value = item.label;
                    datalist.appendChild(option);
                });

            } catch (error) {
                if (error.name !== "AbortError") {
                    console.error(
                        "Destination suggestions error:",
                        error
                    );
                }
            }
        }, 350);
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
        const pickupLocation = await geocodeAddress(pickup);

// Destination ko selected pickup ke hisaab se rank karein
const dropLocation = await geocodeAddress(drop, {
    lat: pickupLocation.lat,
    lng: pickupLocation.lng
});

        const routeUrl =
            `${ORS_API_BASE_URL}/v2/directions/driving-car` +
            `?api_key=${ORS_API_KEY}` +
            `&start=${pickupLocation.lng},${pickupLocation.lat}` +
            `&end=${dropLocation.lng},${dropLocation.lat}`;

        const routeResponse = await fetch(routeUrl);

        if (!routeResponse.ok) {
            throw new Error(`Route request failed: ${routeResponse.status}`);
        }

        const routeData = await routeResponse.json();
        const distanceMeters =
            routeData.features?.[0]?.properties?.summary?.distance;

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
