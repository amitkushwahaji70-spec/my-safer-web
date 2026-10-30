
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

    const hasFocus =
        Number.isFinite(lat) &&
        Number.isFinite(lon) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lon) <= 180;

    try {
        let allFeatures = [];

        // =================================
        // 1. OPENROUTESERVICE SEARCH
        // =================================

        const orsKey = process.env.ORS_API_KEY;

        if (orsKey) {
            try {
                const orsParams = new URLSearchParams({
                    api_key: orsKey,
                    text: query,
                    "boundary.country": "IND",
                    size: "10"
                });

                if (hasFocus) {
                    orsParams.set(
                        "focus.point.lat",
                        String(lat)
                    );

                    orsParams.set(
                        "focus.point.lon",
                        String(lon)
                    );
                }

                const orsResponse = await fetch(
                    `https://api.openrouteservice.org/geocode/search?${orsParams}`
                );

                if (orsResponse.ok) {
                    const orsData = await orsResponse.json();

                    allFeatures.push(
                        ...(orsData.features || []).map(feature => ({
                            ...feature,
                            properties: {
                                ...feature.properties,
                                searchSource: "ors"
                            }
                        }))
                    );
                } else {
                    console.error(
                        "ORS search status:",
                        orsResponse.status
                    );
                }
            } catch (error) {
                console.error("ORS search error:", error);
            }
        }

        // =================================
        // 2. PHOTON SEARCH
        // =================================

        try {
            const photonParams = new URLSearchParams({
                q: query,
                limit: "10",
                lang: "en"
            });

            // India search focus
            photonParams.set("lat", "25.45");
            photonParams.set("lon", "78.15");
            photonParams.set("location_bias_scale", "0.2");

            // Actual pickup focus, when available
            if (hasFocus) {
                photonParams.set("lat", String(lat));
                photonParams.set("lon", String(lon));
            }

            const photonResponse = await fetch(
                `https://photon.komoot.io/api/?${photonParams}`
            );

            if (photonResponse.ok) {
                const photonData = await photonResponse.json();

                const indiaFeatures = (
                    photonData.features || []
                ).filter(feature =>
                    String(
                        feature.properties?.countrycode || ""
                    ).toUpperCase() === "IN"
                );

                allFeatures.push(
                    ...indiaFeatures.map(feature => ({
                        ...feature,
                        properties: {
                            ...feature.properties,
                            searchSource: "photon"
                        }
                    }))
                );
            } else {
                console.error(
                    "Photon search status:",
                    photonResponse.status
                );
            }
        } catch (error) {
            console.error("Photon search error:", error);
        }

        // =================================
        // 3. REMOVE DUPLICATES
        // =================================

        const seen = new Set();

        const uniqueFeatures = allFeatures.filter(feature => {
            const props = feature.properties || {};
            const coords = feature.geometry?.coordinates || [];

            const name = String(
                props.label ||
                props.name ||
                props.street ||
                ""
            ).toLowerCase().trim();

            const coordinateKey =
                Number(coords[0]).toFixed(4) + "," +
                Number(coords[1]).toFixed(4);

            const key = name + "|" + coordinateKey;

            if (seen.has(key)) return false;

            seen.add(key);
            return true;
        });

        return res.status(200).json({
            success: true,
            source: "ors+photon",
            count: uniqueFeatures.length,
            features: uniqueFeatures
        });

    } catch (error) {
        console.error("Location search error:", error);

        return res.status(502).json({
            success: false,
            message: "Location search failed on server"
        });
    }
}

