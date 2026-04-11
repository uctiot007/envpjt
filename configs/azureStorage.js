import { BlobServiceClient } from "@azure/storage-blob";
import { ClientSecretCredential } from "@azure/identity";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure .env is loaded
dotenv.config({ path: path.join(__dirname, '../.env') });

const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID;
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID;
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const AZURE_STORAGE_ENDPOINT = process.env.AZURE_STORAGE_ENDPOINT;
const AZURE_CONTAINER_NAME = process.env.AZURE_CONTAINER_NAME || 'mystorage123';

// Use Client Secret for authentication
const credential = new ClientSecretCredential(
    AZURE_TENANT_ID,
    AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET
);

const blobServiceClient = new BlobServiceClient(
    AZURE_STORAGE_ENDPOINT,
    credential
);

const containerClient = blobServiceClient.getContainerClient(AZURE_CONTAINER_NAME);

export { blobServiceClient, containerClient, AZURE_CONTAINER_NAME };
