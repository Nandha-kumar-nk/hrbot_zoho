const { recruitGET } = require("./recruit");

async function checkModules() {
    try {
        console.log("🔍 Fetching Module Names...");
        const data = await recruitGET("/settings/modules");
        
        console.log("\n✅ AVAILABLE MODULES:");
        data.modules.forEach(m => {
            if(m.api_name.includes("App")) {
                console.log(`Name: ${m.module_name} | API Name: ${m.api_name}`);
            }
        });
    } catch (e) {
        console.log("Error:", e.response ? e.response.data : e.message);
    }
}

checkModules();