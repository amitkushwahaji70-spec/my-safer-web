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

// =====================================
// LOCATIONIQ - EXACT TEXT ADDRESS ONLY
// =====================================

const LOCATIONIQ_API_KEY = "pk.4c006a5c294e6ea44c55d0f1fa4b0226"; 

async function successLocation(position, sendToWhatsApp = false) {

    currentLat = position.coords.latitude;
    currentLng = position.coords.longitude;

    const accuracy = position.coords.accuracy;
    console.log(`GPS Lat/Lng: ${currentLat}, ${currentLng} (Accuracy: ${accuracy}m)`);

    const pickupInput = document.getElementById("pickup");

    if (pickupInput) {
        pickupInput.value = "सटीक एड्रेस डिटेक्ट हो रहा है...";
    }

    // =================================
    // LOCATIONIQ REVERSE GEOCODING
    // Coordinates → Text Address
    // =================================
    try {
        const url = `https://us1.locationiq.com/v1/reverse.php?key=${LOCATIONIQ_API_KEY}&lat=${currentLat}&lon=${currentLng}&format=json&accept-language=hi,en`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`LocationIQ failed with status: ${response.status}`);
        }

        const data = await response.json();

        // LocationIQ से सटीक टेक्स्ट एड्रेस लें
        if (data && data.display_name) {
            currentAddress = data.display_name;
        } else {
            currentAddress = `${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}`;
        }

    } catch (error) {
        console.error("LocationIQ Error:", error);
        currentAddress = `${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}`;
    }

    // =================================
    // INPUT BOX में TEXT भरें
    // =================================
    if (pickupInput) {
        pickupInput.value = currentAddress;
    }

    console.log("Input Text Address:", currentAddress);

    if (sendToWhatsApp) {
        await sendCurrentLocationToWhatsApp();
    }
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


recognition.onstart = function() {
  document.getElementById('micBtn').classList.add('listening');
  document.getElementById('micBtn').innerText = "Listening...";
};

recognition.onend = function() {
  document.getElementById('micBtn').classList.remove('listening');
  document.getElementById('micBtn').innerText = "🎤 Start";

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

    const sendLocationBtn =
    document.getElementById("sendLocationBtn");

if (sendLocationBtn) {
    sendLocationBtn.addEventListener(
        "click",
        () => detectLocation(true)
    );
}

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

    // सुझाव लाने का कॉमन फंक्शन
async function fetchSuggestions(query) {
  if (!query || query.length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&addressdetails=1&limit=5`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.map(item => ({
      name: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon)
    }));
  } catch (err) {
    console.error("Autocomplete Error:", err);
    return [];
  }
}

// सेटअप फंक्शन जो इनपुट से जुड़ेगा
function setupAutocomplete(inputId, listId) {
  const inputElem = document.getElementById(inputId);
  const listElem = document.getElementById(listId);

  if (!inputElem || !listElem) return;

  inputElem.addEventListener("input", async (e) => {
    const query = e.target.value;
    listElem.innerHTML = ""; // पुरानी लिस्ट साफ करें

    if (query.length < 3) return;

    const suggestions = await fetchSuggestions(query);

    suggestions.forEach(item => {
      const li = document.createElement("li");
      li.textContent = item.name;
      li.style.padding = "8px 12px";
      li.style.cursor = "pointer";
      li.style.borderBottom = "1px solid #eee";
      li.style.background = "#fff";
      li.style.fontSize = "14px";

      // माउस ले जाने पर रंग बदले
      li.addEventListener("mouseenter", () => li.style.background = "#f0f0f0");
      li.addEventListener("mouseleave", () => li.style.background = "#fff");

      // जब यूजर किसी सुझाव पर क्लिक करे
      li.addEventListener("click", () => {
        inputElem.value = item.name;
        inputElem.dataset.lat = item.lat; // लेट सहेजें
        inputElem.dataset.lon = item.lon; // लॉन्ग सहेजें
        listElem.innerHTML = "";          // लिस्ट बंद करें
      });

      listElem.appendChild(li);
    });
  });

  // बाहर क्लिक करने पर लिस्ट छिप जाए
  document.addEventListener("click", (e) => {
    if (!inputElem.contains(e.target) && !listElem.contains(e.target)) {
      listElem.innerHTML = "";
    }
  });
}

// दोनों इनपुट पर ऑटो-सजेशन चालू करें
setupAutocomplete("pickup", "pickup-suggestions");
setupAutocomplete("destination", "destination-suggestions");




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

// यह फाइनल फंक्शन जोड़ें 
function getFinalDistanceAndFare(pickupLat, pickupLon, dropLat, dropLon, apiDistance) {
    let distance = apiDistance; 
    // अगर API से दूरी न मिले या 0 हो (गांव या लोकल सिटी के लिए) 
    if (!distance || distance <= 0) { 
        const R = 6371; // Earth radius in KM 
        const dLat = ((dropLat - pickupLat) * Math.PI) / 180;
        const dLon = ((dropLon - pickupLon) * Math.PI) / 180; 
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + 
                  Math.cos((pickupLat * Math.PI) / 180) * Math.cos((dropLat * Math.PI) / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2); 
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
        const straightKm = R * c; 
        
        distance = Math.max(1, Math.round((straightKm * 1.2) * 10) / 10); // सड़क के मोड़ के लिए 20% एक्स्ट्रा } /
        
    // किराया कैलकुलेशन (न्यूनतम ₹50 और ₹15 प्रति किमी) 
        const minFare = 50;
        const ratePerKm = 15;
        let fare = Math.max(Math.round(distance * ratePerKm), minFare);
        return { distance, fare }; 
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


// ===================================
// SEND CONFIRMED BOOKING TO SERVER
// ===================================

async function sendConfirmedBooking(booking) {
    try {
        console.log("Sending booking:", booking);

        const response = await fetch(
            "https://my-safer-web.vercel.app/api/send-booking",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    bookingId: booking.bookingId,
                    pickup: booking.pickupLabel,
                    destination: booking.dropLabel,
                    distance: Number(booking.distance).toFixed(1),
                    fare: booking.fare
                })
            }
        );

        const responseText = await response.text();

        console.log("API Status:", response.status);
        console.log("API Response:", responseText);

        let data;

        try {
            data = JSON.parse(responseText);
        } catch {
            throw new Error(
                `Server returned invalid response: ${responseText}`
            );
        }

        if (!response.ok) {
            throw new Error(
                data.message ||
                `Server error: ${response.status}`
            );
        }

        if (!data.success) {
            throw new Error(
                data.message ||
                "WhatsApp server rejected the booking."
            );
        }

        alert(
            "Booking Confirmed! ✅\n\n" +
            "Booking ID: " +
            booking.bookingId
        );

        const confirmation =
            document.getElementById("bookingConfirmation");

        if (confirmation) {
            confirmation.classList.remove("show");
        }

    } catch (error) {

        console.error("WHATSAPP BOOKING ERROR:", error);

        alert(
            "WhatsApp booking failed ❌\n\n" +
            error.message
        );
    }
}
// =====================================
// SEND CURRENT LOCATION TO WHATSAPP
// =====================================

async function sendCurrentLocationToWhatsApp() {
    // 1. चेक करें कि लेटेस्ट कोऑर्डिनेट्स मौजूद हैं या नहीं
    if (!currentLat || !currentLng) {
        alert("कृपया पहले 'Detect Location' पर क्लिक करके लोकेशन फेच करें!");
        return;
    }

    // 2. Google Maps का सटीक लिंक बनाएं
    const mapsLink = `https://www.google.com/maps?q=${currentLat},${currentLng}`;
    
    // 3. WhatsApp पर भेजने के लिए मैसेज तैयार करें
    const message = encodeURIComponent(
        `Hello culiGO! 🚚\nयहाँ से मेरा सामान उठाना है (Pickup Location):\n📍 एड्रेस: ${currentAddress}\n🗺️ Google Maps Link: ${mapsLink}`
    );

    // 4. अपना WhatsApp नंबर यहाँ डालें (देश के कोड के साथ, जैसे 91 लगाकार)
    const phoneNumber = "917974483199"; // <--- यहाँ अपना व्हाट्सएप नंबर बदल लें

    // 5. WhatsApp चैट खोलें
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
    
    window.open(whatsappUrl, '_blank');
}

// =====================================
// DIRECT PHONE CALL
// =====================================

function makeCall() {

    window.location.href =
        "tel:+919244130492";

}
