const axios = require("axios");
require("dotenv").config();

async function diagnoseToken() {
    console.log("🔍 Diagnosing Zoho OAuth Response...\n");
    
    // Check what's being read from .env
    console.log("📁 Environment Variables:");
    console.log("  REFRESH_TOKEN:", process.env.ZOHO_RECRUIT_REFRESH_TOKEN?.substring(0, 20) + "...");
    console.log("  CLIENT_ID:", process.env.ZOHO_RECRUIT_CLIENT_ID?.substring(0, 15) + "...");
    console.log("  CLIENT_SECRET:", process.env.ZOHO_RECRUIT_CLIENT_SECRET?.substring(0, 10) + "...");
    console.log("  BASE_URL:", process.env.ZOHO_RECRUIT_BASE);
    console.log("\n");
    
    // Check if any are undefined
    if (!process.env.ZOHO_RECRUIT_REFRESH_TOKEN) {
        console.error("❌ ZOHO_RECRUIT_REFRESH_TOKEN is not set!");
        return;
    }
    if (!process.env.ZOHO_RECRUIT_CLIENT_ID) {
        console.error("❌ ZOHO_RECRUIT_CLIENT_ID is not set!");
        return;
    }
    if (!process.env.ZOHO_RECRUIT_CLIENT_SECRET) {
        console.error("❌ ZOHO_RECRUIT_CLIENT_SECRET is not set!");
        return;
    }
    
    try {
        const response = await axios.post(
            "https://accounts.zoho.in/oauth/v2/token",
            null,
            {
                params: {
                    refresh_token: process.env.ZOHO_RECRUIT_REFRESH_TOKEN,
                    client_id: process.env.ZOHO_RECRUIT_CLIENT_ID,
                    client_secret: process.env.ZOHO_RECRUIT_CLIENT_SECRET,
                    grant_type: "refresh_token"
                }
            }
        );
        
        console.log("✅ Token request successful!\n");
        console.log("📋 FULL RESPONSE DATA:");
        console.log(JSON.stringify(response.data, null, 2));
        console.log("\n");
        
        console.log("🔑 Available fields:");
        Object.keys(response.data).forEach(key => {
            console.log(`  - ${key}: ${response.data[key]}`);
        });
        
        console.log("\n");
        
        // Try to identify the token field
        const possibleTokenFields = ['access_token', 'token', 'accessToken', 'oauth_token'];
        let foundToken = null;
        
        for (const field of possibleTokenFields) {
            if (response.data[field]) {
                foundToken = field;
                console.log(`✅ Found token in field: "${field}"`);
                console.log(`   Value: ${response.data[field].substring(0, 30)}...`);
                break;
            }
        }
        
        if (!foundToken) {
            console.log("❌ Token not found in expected fields!");
            console.log("   Please check the 'Available fields' list above.");
        }
        
    } catch (error) {
        console.error("❌ Token request failed:");
        console.error("Status:", error.response?.status);
        console.error("Error Data:", error.response?.data);
        console.error("Message:", error.message);
    }
}

diagnoseToken();
