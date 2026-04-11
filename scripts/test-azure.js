import { containerClient } from '../configs/azureStorage.js';

async function testAzureConnection() {
    console.log("🧪 Testing Azure Blob Storage Connection...");
    try {
        // 1. Check if container exists
        const exists = await containerClient.exists();
        if (exists) {
            console.log("✅ Container exists!");
        } else {
            console.log("⚠️ Container does not exist. Attempting to create...");
            await containerClient.create();
            console.log("✅ Container created!");
        }

        // 2. Try listing blobs (even if zero)
        console.log("📂 Listing blobs in container...");
        for await (const blob of containerClient.listBlobsFlat()) {
            console.log(` - ${blob.name}`);
        }

        console.log("\n🎉 Azure Connection Verified!");
    } catch (err) {
        console.error("❌ Azure Connection Failed:", err.message);
        if (err.message.includes("AuthenticationFailed")) {
            console.error("👉 Tip: Check your Client Secret, Client ID, and Tenant ID in .env.");
        }
    }
    process.exit(0);
}

testAzureConnection();
