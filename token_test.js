const axios = require("axios");
require("dotenv").config();

async function testTokenGeneration() {
    console.log("Testing token generation...\n");
    
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
        
        console.log("✅ SUCCESS! Full Response:");
        console.log(JSON.stringify(response.data, null, 2)); // Print full response
        
        console.log("\n📝 Access Token:", response.data.access_token);
        
    } catch (error) {
        console.error("❌ FAILED!");
        console.error("Error:", error.response?.data || error.message);
    }
}

testTokenGeneration();
