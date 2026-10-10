export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed" });

  try {
    const { bookingId, pickup, destination, distance, fare } = req.body;

    if (!bookingId || !pickup || !destination || !distance || fare === undefined) {
      return res.status(400).json({ success: false, message: "Booking details incomplete" });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const YOUR_EMAIL = "amitkushwahaji70@gmail.com";

    if (!RESEND_API_KEY) {
      return res.status(500).json({ success: false, message: "RESEND_API_KEY missing" });
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "culiGO Booking <onboarding@resend.dev>",
        to: YOUR_EMAIL,
        subject: `🚖 NEW BOOKING CONFIRMED: #${bookingId}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h2 style="color: #0284c7;">🚖 New Booking Alert!</h2>
            <p><strong>Booking ID:</strong> ${bookingId}</p>
            <p><strong>📍 Pickup:</strong> ${pickup}</p>
            <p><strong>📍 Destination:</strong> ${destination}</p>
            <p><strong>📏 Distance:</strong> ${distance} km</p>
            <p><strong>💰 Fare:</strong> ₹${fare}</p>
          </div>
        `,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      return res.status(200).json({ success: true, message: "Booking email sent!" });
    } else {
      return res.status(500).json({ success: false, message: "Failed to send email", error: data });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
}
