// =====================================
// SAFER SAMAN BOOKING SYSTEM
// LOCATION + ORS + DISTANCE + FARE
// + CONFIRMATION + WHATSAPP + CALL
// =====================================


// =====================================
// SETTINGS
// =====================================

const RATE_PER_KM = 15;

const ORS_API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjkyNWViMmNhODVkZDQ0MTBiZjE5M2Q3ZWI0YjVjMjQ2IiwiaCI6Im11cm11cjY0In0=";


const ORS_BASE_URL = "https://api.heigit.org";


// =====================================
// CURRENT LOCATION DATA
// =====================================

let currentAddress = "";
let currentLat = null;
let currentLng = null;


// =====================================
// CURRENT BOOKING
// =====================================

let currentBooking = null;


// =====================================
// PAGE LOAD
// =====================================

window.addEventListener("load", () => {

    console.log("SAFER SAMAN loaded");

    initializeVoiceSearch();

    bindButtons();

    // Automatically detect current location
    detectLocation();

});


// =====================================
// DETECT CURRENT LOCATION
// =====================================

function detectLocation() {

    if (!navigator.geolocation) {

        alert("Your browser does not support location.");

        return;
    }

    console.log("Requesting current location...");

    navigator.geolocation.getCurrentPosition(

        successLocation,

        handleLocationError,

        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        }

    );
}


// =====================================
// LOCATION SUCCESS
// =====================================

async function successLocation(position) {

    currentLat = position.coords.latitude;
    currentLng = position.coords.longitude;

    const accuracy = position.coords.accuracy;

    console.log("=================================");
    console.log("CURRENT LOCATION");
    console.log("Latitude:", currentLat);
    console.log("Longitude:", currentLng);
    console.log("Accuracy:", accuracy, "meters");
    console.log("=================================");


    const pickupInput =
        document.getElementById("pickup");


    if (pickupInput) {

        pickupInput.value =
            "Detecting location...";

    }


    // =================================
    // REVERSE GEOCODING
    // Coordinates → Address
    // =================================

    try {

        const url =
            `${ORS_BASE_URL}/pelias/v1/reverse` +
            `?api_key=${ORS_API_KEY}` +
            `&point.lon=${currentLng}` +
            `&point.lat=${currentLat}`;


        console.log(
            "Reverse Geocoding URL:",
            url
        );


        const response =
            await fetch(url);


        if (!response.ok) {

            throw new Error(
                `Reverse geocoding failed: ${response.status}`
            );

        }


        const data =
            await response.json();


        console.log(
            "Reverse Geocoding Response:",
            data
        );


        if (
            data.features &&
            data.features.length > 0
        ) {

            currentAddress =
                data.features[0].properties.label ||
                data.features[0].properties.name ||
                `${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}`;

        } else {

            currentAddress =
                `${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}`;

        }


    }

    catch (error) {

        console.error(
            "Reverse geocoding error:",
            error
        );


        currentAddress =
            `${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}`;

    }


    // =================================
    // PUT LOCATION INTO PICKUP
    // =================================

    if (pickupInput) {

        pickupInput.value =
            currentAddress;

    }


    console.log(
        "Current Address:",
        currentAddress
    );

}


// =====================================
// FORWARD GEOCODING
// Address → Coordinates
// =====================================

async function geocodeAddress(address) {

    if (!address) {

        throw new Error(
            "Address is empty."
        );

    }


    const url =
        `${ORS_BASE_URL}/pelias/v1/search` +
        `?api_key=${ORS_API_KEY}` +
        `&text=${encodeURIComponent(address)}`;


    const response =
        await fetch(url);


    if (!response.ok) {

        throw new Error(
            `Geocoding failed: ${response.status}`
        );

    }


    const data =
        await response.json();


    console.log(
        "Geocoding:",
        address,
        data
    );


    if (
        !data.features ||
        data.features.length === 0
    ) {

        throw new Error(
            `Location not found: ${address}`
        );

    }


    const coordinates =
        data.features[0].geometry.coordinates;


    return {

        lng: coordinates[0],

        lat: coordinates[1],

        label:
            data.features[0].properties.label ||
            data.features[0].properties.name ||
            address

    };

}


// =====================================
// LOCATION ERROR
// =====================================

function handleLocationError(error) {

    console.error(
        "Location Error:",
        error
    );


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

            alert(
                "Unable to detect your current location."
            );

    }

}


// =====================================
// VOICE SEARCH
// =====================================

function initializeVoiceSearch() {

    const micBtn =
        document.getElementById("micBtn");


    if (!micBtn) return;


    micBtn.addEventListener(
        "click",
        startVoiceSearch
    );

}


// =====================================
// START VOICE SEARCH
// =====================================

function startVoiceSearch() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;


    if (!SpeechRecognition) {

        alert(
            "Voice search is not supported in this browser."
        );

        return;

    }


    const recognition =
        new SpeechRecognition();


    recognition.lang =
        "hi-IN";

    recognition.interimResults =
        false;

    recognition.maxAlternatives =
        1;


    recognition.start();


    recognition.onstart = () => {

        console.log(
            "Voice recognition started."
        );

    };


    recognition.onresult = (event) => {

        const text =
            event.results[0][0].transcript;


        const dropInput =
            document.getElementById("drop");


        if (dropInput) {

            dropInput.value =
                text;

        }


        console.log(
            "Voice destination:",
            text
        );

    };


    recognition.onerror = (event) => {

        console.error(
            "Voice recognition error:",
            event.error
        );

    };

}


// =====================================
// BUTTON EVENTS
// =====================================

function bindButtons() {

    const locationBtn =
        document.getElementById("locationBtn");


    const bookBtn =
        document.getElementById("bookBtn");


    const callBtn =
        document.getElementById("callBtn");


    const confirmBookingBtn =
        document.getElementById(
            "confirmBookingBtn"
        );


    const editBookingBtn =
        document.getElementById(
            "editBookingBtn"
        );


    // Location
    if (locationBtn) {

        locationBtn.addEventListener(
            "click",
            detectLocation
        );

    }


    // Book Now
    if (bookBtn) {

        bookBtn.addEventListener(
            "click",
            calculateBooking
        );

    }


    // Call
    if (callBtn) {

        callBtn.addEventListener(
            "click",
            makeCall
        );

    }


    // Confirm Booking
    if (confirmBookingBtn) {

        confirmBookingBtn.addEventListener(
            "click",
            confirmBooking
        );

    }


    // Edit Booking
    if (editBookingBtn) {

        editBookingBtn.addEventListener(
            "click",
            editBooking
        );

    }

}


// =====================================
// CALCULATE BOOKING
// =====================================

async function calculateBooking() {

    const pickupInput =
        document.getElementById("pickup");


    const dropInput =
        document.getElementById("drop");


    if (!pickupInput || !dropInput) {

        console.error(
            "Pickup or drop input not found."
        );

        return;

    }


    const pickup =
        pickupInput.value.trim();


    const drop =
        dropInput.value.trim();


    // =================================
    // VALIDATION
    // =================================

    if (!pickup || !drop) {

        alert(
            "Please Enter Pickup & Destination"
        );

        return;

    }


    try {

        // =================================
        // SHOW CALCULATING
        // =================================

        document.getElementById(
            "distance"
        ).innerText =
            "Calculating...";


        document.getElementById(
            "fare"
        ).innerText =
            "₹--";


        // =================================
        // PICKUP GEOCODING
        // =================================

        console.log(
            "Searching Pickup:",
            pickup
        );


        const pickupLocation =
            await geocodeAddress(
                pickup
            );


        console.log(
            "Pickup Coordinates:",
            pickupLocation.lat,
            pickupLocation.lng
        );


        // =================================
        // DESTINATION GEOCODING
        // =================================

        console.log(
            "Searching Destination:",
            drop
        );


        const dropLocation =
            await geocodeAddress(
                drop
            );


        console.log(
            "Drop Coordinates:",
            dropLocation.lat,
            dropLocation.lng
        );


        // =================================
        // GET ROUTE
        // =================================

        const routeUrl =
            `${ORS_BASE_URL}/openrouteservice/v2/directions/driving-car` +
            `?api_key=${ORS_API_KEY}` +
            `&start=${pickupLocation.lng},${pickupLocation.lat}` +
            `&end=${dropLocation.lng},${dropLocation.lat}`;


        console.log(
            "Route URL:",
            routeUrl
        );


        const routeResponse =
            await fetch(routeUrl);


        if (!routeResponse.ok) {

            throw new Error(
                `Route request failed: ${routeResponse.status}`
            );

        }


        const routeData =
            await routeResponse.json();


        if (
            !routeData.features ||
            routeData.features.length === 0
        ) {

            throw new Error(
                "Route not found."
            );

        }


        // =================================
        // DISTANCE
        // =================================

        const distanceKM =
            routeData
                .features[0]
                .properties
                .summary
                .distance / 1000;


        // =================================
        // FARE
        // =================================

        const fare =
            Math.round(
                distanceKM * RATE_PER_KM
            );


        // =================================
        // SHOW DISTANCE
        // =================================

        const distanceElement =
            document.getElementById(
                "distance"
            );


        if (distanceElement) {

            distanceElement.innerText =
                distanceKM.toFixed(1) +
                " km";

        }


        // =================================
        // SHOW FARE
        // =================================

        const fareElement =
            document.getElementById(
                "fare"
            );


        if (fareElement) {

            fareElement.innerText =
                "₹" + fare;

        }


        // =================================
        // SAVE BOOKING DATA
        // =================================

        currentBooking = {

            pickup: pickup,

            pickupLabel:
                pickupLocation.label,

            pickupLat:
                pickupLocation.lat,

            pickupLng:
                pickupLocation.lng,


            drop: drop,

            dropLabel:
                dropLocation.label,

            dropLat:
                dropLocation.lat,

            dropLng:
                dropLocation.lng,


            distance:
                distanceKM,

            fare:
                fare

        };


        // =================================
        // SHOW CONFIRMATION
        // =================================

        const confirmPickup =
            document.getElementById(
                "confirmPickup"
            );


        const confirmDrop =
            document.getElementById(
                "confirmDrop"
            );


        const confirmDistance =
            document.getElementById(
                "confirmDistance"
            );


        const confirmFare =
            document.getElementById(
                "confirmFare"
            );


        if (confirmPickup) {

            confirmPickup.innerText =
                pickupLocation.label;

        }


        if (confirmDrop) {

            confirmDrop.innerText =
                dropLocation.label;

        }


        if (confirmDistance) {

            confirmDistance.innerText =
                distanceKM.toFixed(1) +
                " km";

        }


        if (confirmFare) {

            confirmFare.innerText =
                "₹" + fare;

        }


        const confirmation =
            document.getElementById(
                "bookingConfirmation"
            );


        if (confirmation) {

            confirmation.classList.add(
                "show"
            );

        }


        console.log(
            "BOOKING CALCULATED:",
            currentBooking
        );

    }


    catch (error) {

        console.error(
            "Booking Calculation Error:",
            error
        );


        document.getElementById(
            "distance"
        ).innerText =
            "--";


        document.getElementById(
            "fare"
        ).innerText =
            "₹--";


        alert(
            "Location or route could not be found. Please check the addresses."
        );

    }

}


// =====================================
// CONFIRM BOOKING
// =====================================

function confirmBooking() {

    if (!currentBooking) {

        alert(
            "Please calculate your booking first."
        );

        return;

    }


    // =================================
    // GENERATE BOOKING ID
    // =================================

    const now =
        new Date();


    const date =
        String(
            now.getDate()
        ).padStart(2, "0");


    const month =
        String(
            now.getMonth() + 1
        ).padStart(2, "0");


    const year =
        String(
            now.getFullYear()
        ).slice(-2);


    const random =
        Math.floor(
            1000 +
            Math.random() * 9000
        );


    const bookingId =
        `SS${date}${month}${year}-${random}`;


    currentBooking.bookingId =
        bookingId;


    currentBooking.status =
        "Pending";


    console.log(
        "BOOKING CREATED:",
        currentBooking
    );


    // =================================
    // SEND TO WHATSAPP
    // =================================

    sendConfirmedBooking(
        currentBooking
    );

}


// =====================================
// EDIT BOOKING
// =====================================

function editBooking() {

    const confirmation =
        document.getElementById(
            "bookingConfirmation"
        );


    if (confirmation) {

        confirmation.classList.remove(
            "show"
        );

    }


    const pickupInput =
        document.getElementById(
            "pickup"
        );


    if (pickupInput) {

        pickupInput.focus();

    }

}


// =====================================
// SEND CONFIRMED BOOKING
// =====================================

function sendConfirmedBooking(
    booking
) {

    const message =
`🚚 SAFER SAMAN BOOKING

🆔 Booking ID:
${booking.bookingId}

📍 Pickup:
${booking.pickupLabel}

⬇️ Destination:
${booking.dropLabel}

📏 Distance:
${booking.distance.toFixed(1)} km

💰 Estimated Fare:
₹${booking.fare}

📌 Status:
Pending

Please confirm this booking.`;


    const number =
        "919244130492";


    const whatsappUrl =
        `https://wa.me/${number}?text=` +
        encodeURIComponent(
            message
        );


    window.open(
        whatsappUrl,
        "_blank"
    );

}


// =====================================
// DIRECT PHONE CALL
// =====================================

function makeCall() {

    window.location.href =
        "tel:+919244130492";

}