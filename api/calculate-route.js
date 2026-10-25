
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  const apiKey = process.env.ORS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: "ORS_API_KEY is missing in server environment"
    });
  }

  try {
    const { start, end } = req.body || {};

    const validPoint = (p) =>
      p &&
      Number.isFinite(Number(p.lat)) &&
      Number.isFinite(Number(p.lng)) &&
      Math.abs(Number(p.lat)) <= 90 &&
      Math.abs(Number(p.lng)) <= 180;

    if (!validPoint(start) || !validPoint(end)) {
      return res.status(400).json({
        success: false,
        error: "Invalid pickup or destination coordinates"
      });
    }

    const response = await fetch(
      "https://api.openrouteservice.org/v2/directions/driving-car",
      {
        method: "POST",
        headers: {
          "Authorization": apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          coordinates: [
            [Number(start.lng), Number(start.lat)],
            [Number(end.lng), Number(end.lat)]
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("ORS route error:", data);

      return res.status(response.status).json({
        success: false,
        error: "Route service failed"
      });
    }

    const distanceMeters = data.routes?.[0]?.summary?.distance;

    if (!Number.isFinite(distanceMeters)) {
      return res.status(502).json({
        success: false,
        error: "Route distance was not returned"
      });
    }

    return res.status(200).json({
      success: true,
      distanceMeters,
      distanceKm: distanceMeters / 1000
    });
  } catch (error) {
    console.error("Calculate route error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to calculate route"
    });
  }
}
