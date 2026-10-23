
export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "GET") {
        return res.status(405).json({
            success: false,
            message: "Method not allowed"
        });
    }

    const query = String(req.query.q || "").trim();

    if (query.length < 2) {
        return res.status(400).json({
            success: false,
            message: "Enter at least 2 characters"
        });
    }

    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);

    try {
        // Try ORS first
        const orsKey = process.env.ORS_API_KEY;

        if (orsKey) {
            const params = new URLSearchParams({
                api_key: orsKey,
                text: query,
                "boundary.country": "IND",
                size: "10"
            });

            if (Number.isFinite(lat) && Number.isFinite(lon)) {
                params.set("focus.point.lat", String(lat));
                params.set("focus.point.lon", String(lon));
            }

            const orsResponse = await fetch(
                `https://api.openrouteservice.org/geocode/search?${params}`
            );

            if (orsResponse.ok) {
                const orsData = await orsResponse.json();

                if (orsData.features?.length) {
                    return res.status(200).json({
                        success: true,
                        source: "ors",
                        features: orsData.features
                    });
                }
            } else {
                console.error("ORS status:", orsResponse.status);
            }
        }

        // Fallback: Photon / OpenStreetMap
        const params = new URLSearchParams({
            q: query,
            limit: "10"
        });

        if (Number.isFinite(lat) && Number.isFinite(lon)) {
            params.set("lat", String(lat));
            params.set("lon", String(lon));
        }

        const photonResponse = await fetch(
            `https://photon.komoot.io/api/?${params}`
        );

        if (!photonResponse.ok) {
            return res.status(502).json({
                success: false,
                message: "Location search providers failed"
            });
        }

        const photonData = await photonResponse.json();

        return res.status(200).json({
            success: true,
            source: "photon",
            features: photonData.features || []
        });

    } catch (error) {
        console.error("Location search error:", error);

        return res.status(502).json({
            success: false,
            message: "Location search failed on server"
        });
    }
}
