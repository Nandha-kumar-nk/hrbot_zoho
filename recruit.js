const axios = require("axios");
require("dotenv").config();

let cachedToken = null;
let tokenExpireTime = null;

// Generate and cache access token
async function generateAccessToken() {
    const now = Date.now();
    
    // Return cached token if still valid
    if (cachedToken && tokenExpireTime && now < tokenExpireTime) {
        console.log("📦 Using cached token");
        return cachedToken;
    }
    
    console.log("🔄 Generating new token...");
    
    try {
        const tokenUrl = "https://accounts.zoho.in/oauth/v2/token";
        
        const response = await axios.post(tokenUrl, null, {
            params: {
                refresh_token: process.env.ZOHO_RECRUIT_REFRESH_TOKEN,
                client_id: process.env.ZOHO_RECRUIT_CLIENT_ID,
                client_secret: process.env.ZOHO_RECRUIT_CLIENT_SECRET,
                grant_type: "refresh_token"
            }
        });
        
        // Extract token
        const token = response.data.access_token;
        const expiresIn = response.data.expires_in || 3600;
        
        if (!token) {
            console.error("❌ No token found in response!");
            throw new Error("Failed to extract access token from response");
        }
        
        // Cache the token
        cachedToken = token;
        tokenExpireTime = now + (expiresIn * 1000) - 60000;
        
        console.log("✅ Token generated successfully");
        return token;
        
    } catch (error) {
        console.error("❌ Token generation failed:");
        console.error("Error:", error.response?.data || error.message);
        throw error;
    }
}

// GET request wrapper for Zoho Recruit API
async function recruitGET(endpoint) {
    try {
        const token = await generateAccessToken();
        
        const url = process.env.ZOHO_RECRUIT_BASE + endpoint;
        console.log("📡 GET:", url);
        
        const response = await axios.get(url, {
            headers: { 
                Authorization: `Zoho-oauthtoken ${token}`,
                "Content-Type": "application/json"
            }
        });
        
        console.log("✅ GET successful");
        return response.data;
        
    } catch (error) {
        console.error("❌ GET failed:", error.response?.data || error.message);
        throw error;
    }
}

// POST request wrapper for Zoho Recruit API
async function recruitPOST(endpoint, body) {
    try {
        const token = await generateAccessToken();
        
        const url = process.env.ZOHO_RECRUIT_BASE + endpoint;
        console.log("📡 POST:", url);
        
        const response = await axios.post(url, body, {
            headers: { 
                Authorization: `Zoho-oauthtoken ${token}`,
                "Content-Type": "application/json"
            }
        });
        
        console.log("✅ POST successful");
        return response.data;
        
    } catch (error) {
        console.error("❌ POST failed:", error.response?.data || error.message);
        throw error;
    }
}

// PUT request wrapper for Zoho Recruit API
async function recruitPUT(endpoint, body) {
    try {
        const token = await generateAccessToken();
        
        const url = process.env.ZOHO_RECRUIT_BASE + endpoint;
        console.log("📡 PUT:", url);
        
        const response = await axios.put(url, body, {
            headers: { 
                Authorization: `Zoho-oauthtoken ${token}`,
                "Content-Type": "application/json"
            }
        });
        
        console.log("✅ PUT successful");
        return response.data;
        
    } catch (error) {
        console.error("❌ PUT failed:", error.response?.data || error.message);
        throw error;
    }
}

module.exports = { recruitGET, recruitPOST, recruitPUT };
