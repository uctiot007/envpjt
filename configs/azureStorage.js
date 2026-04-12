import { BlobServiceClient } from "@azure/storage-blob";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure .env is loaded
dotenv.config({ path: path.join(__dirname, '../.env') });

const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const AZURE_CONTAINER_NAME = process.env.AZURE_CONTAINER_NAME || 'images';

if (!AZURE_STORAGE_CONNECTION_STRING) {
    console.error("❌ AZURE_STORAGE_CONNECTION_STRING is missing from .env! Azure uploads will fail.");
}

// Initialize with Connection String (guard against missing env var at import time)
const blobServiceClient = AZURE_STORAGE_CONNECTION_STRING
    ? BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING)
    : null;
const containerClient = blobServiceClient
    ? blobServiceClient.getContainerClient(AZURE_CONTAINER_NAME)
    : null;

/**
 * Generic Utility to upload a buffer to Azure
 */
const uploadToAzure = async (buffer, fileName, contentType) => {
    if (!containerClient) throw new Error("Azure containerClient is not initialized — check AZURE_STORAGE_CONNECTION_STRING in .env");

    if (!(await containerClient.exists())) {
        await containerClient.createIfNotExists();
    }

    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    await blockBlobClient.uploadData(buffer, {
        blobHTTPHeaders: { blobContentType: contentType }
    });
    return blockBlobClient.url;
};

export { blobServiceClient, containerClient, AZURE_CONTAINER_NAME, uploadToAzure };
