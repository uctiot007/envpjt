import { containerClient } from '../configs/azureStorage.js';

async function testAzureConnection() {
    console.log("\n🧪 Testing Azure Blob Storage Connection...");

    if (!containerClient) {
        console.error("❌ Azure containerClient is null — AZURE_STORAGE_CONNECTION_STRING is missing from .env");
        return;
    }

    try {
        // 1. Check if container exists
        const exists = await containerClient.exists();
        if (exists) {
            console.log("✅ Azure container exists and is reachable!");
        } else {
            console.log("⚠️ Container does not exist. Attempting to create...");
            await containerClient.create();
            console.log("✅ Container created!");
        }

        // 2. Try listing blobs (even if zero)
        let blobCount = 0;
        for await (const blob of containerClient.listBlobsFlat()) {
            blobCount++;
        }
        console.log(`📂 Container has ${blobCount} blob(s).`);
        console.log("🎉 Azure connection verified successfully!\n");
    } catch (err) {
        console.error("❌ Azure Connection Failed:", err.message);
    }
    // NOTE: No process.exit() here — this runs as a "pre" npm hook and must NOT exit.
}

testAzureConnection();
