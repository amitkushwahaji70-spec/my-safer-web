export default async function handler(req, res) {

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  try {

    const {
      bookingId,
      pickup,
      destination,
      distance,
      fare,
      phone
    } = req.body;
    const rawPhone = phone || "919244130492";
    const recipientNumber = rawPhone.replace(/\D/g, ''); // केवल अंक रखेगा

    // Validation
    if (
      !bookingId ||
      !pickup ||
      !destination ||
      !distance ||
      fare === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Booking details are incomplete"
      });
    }

    const accessToken =
      process.env.WHATSAPP_ACCESS_TOKEN;

    const phoneNumberId =
      process.env.WHATSAPP_PHONE_NUMBER_ID;

    const recipientNumber =
      process.env.WHATSAPP_RECIPIENT_NUMBER;

    if (
      !accessToken ||
      !phoneNumberId ||
      !recipientNumber
    ) {
      return res.status(500).json({
        success: false,
        message: "WhatsApp environment variables are missing"
      });
    }

    const message =
`🚖 NEW BOOKING

Booking ID: ${bookingId}

📍 Pickup:
${pickup}

📍 Destination:
${destination}

📏 Distance:
${distance} km

💰 Fare:
₹${fare}

Please contact the customer/driver for this booking.`;

    const response = await fetch(
      `https://graph.facebook.com/v26.0/${phoneNumberId}/messages`,
      {
        method: "POST",

        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipientNumber,
          type: "text",
          text: {
            preview_url: false,
            body: message
          }
        })
      }
    );

    const data = await response.json();

    console.log(
      "WhatsApp Booking Response:",
      data
    );

    if (!response.ok) {

      return res.status(response.status).json({
        success: false,
        message:
          data?.error?.message ||
          "WhatsApp message failed",
        error: data
      });

    }

    return res.status(200).json({
      success: true,
      message: "Booking sent successfully",
      whatsapp: data
    });

  } catch (error) {

    console.error(
      "Booking Server Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });

  }

}
