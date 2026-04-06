import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

console.log("🔍 Checking Cloudinary Config...");
console.log("- Cloud Name:", process.env.CLOUDINARY_CLOUD_NAME ? "PRESENT" : "MISSING");
console.log("- API Key:", process.env.CLOUDINARY_API_KEY ? "PRESENT" : "MISSING");
console.log("- API Secret:", process.env.CLOUDINARY_API_SECRET ? "PRESENT" : "MISSING");

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

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
