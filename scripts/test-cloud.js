import cloudinary from '../configs/cloudinary.js';

console.log("🔍 Checking Cloudinary Config via Centralized Config...");
console.log("- Cloud Name:", cloudinary.config().cloud_name ? "PRESENT" : "MISSING");
console.log("- API Key:", cloudinary.config().api_key ? "PRESENT" : "MISSING");
console.log("- API Secret:", cloudinary.config().api_secret ? "PRESENT" : "MISSING");

console.log("\n📡 Pinging Cloudinary...");
cloudinary.api.ping()
    .then(res => {
        console.log("✅ SUCCESS: Cloudinary is connected and ready!");
        process.exit(0);
    })
    .catch(err => {
        console.error("❌ ERROR: Cloudinary connection failed.");
        console.error("Reason:", err.message);
        process.exit(1);
    });
