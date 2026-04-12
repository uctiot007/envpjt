import path from 'path';
import { fileURLToPath } from 'url';
import cloudinary from '../configs/cloudinary.js';
import { uploadToAzure, containerClient } from '../configs/azureStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESOURCE_TYPES = ['image', 'raw', 'video'];
const MAX_RESULTS = 500;

const listResources = async (resourceType) => {
    let resources = [];
    let nextCursor = undefined;

    do {
        const response = await cloudinary.api.resources({
            resource_type: resourceType,
            type: 'upload',
            max_results: MAX_RESULTS,
            next_cursor: nextCursor
        });

        if (response.resources && response.resources.length) {
            resources = resources.concat(response.resources);
        }

        nextCursor = response.next_cursor;
    } while (nextCursor);

    return resources;
};

const downloadBuffer = async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    return { buffer, contentType };
};

const getAzureBlobName = (resource) => {
    const extension = resource.format ? `.${resource.format}` : '';
    return `cloudinary/${resource.public_id}${extension}`;
};

const migrateResource = async (resource, resourceType) => {
    const url = resource.secure_url || resource.url;
    if (!url) {
        throw new Error(`Missing download URL for ${resource.public_id}`);
    }

    const { buffer, contentType } = await downloadBuffer(url);
    const blobName = getAzureBlobName(resource);
    const azureUrl = await uploadToAzure(buffer, blobName, contentType);
    return { public_id: resource.public_id, resourceType, azureUrl, blobName };
};

async function runMigration() {
    console.log('🚀 Cloudinary → Azure migration starting...');
    console.log(`Azure container: ${containerClient.containerName}`);

    if (!(await containerClient.exists())) {
        console.log('🆕 Azure container does not exist. Creating it now...');
        await containerClient.createIfNotExists();
        console.log('✅ Azure container created.');
    }

    let total = 0;
    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    for (const type of RESOURCE_TYPES) {
        console.log(`\n📦 Listing Cloudinary resources for type: ${type}`);
        const resources = await listResources(type);
        console.log(`   Found ${resources.length} ${type} resources.`);

        for (const resource of resources) {
            total += 1;
            try {
                const result = await migrateResource(resource, type);
                migrated += 1;
                console.log(`   ✅ Migrated ${type}: ${result.public_id} -> ${result.blobName}`);
            } catch (err) {
                failed += 1;
                console.error(`   ❌ Failed ${type}: ${resource.public_id} — ${err.message}`);
            }
        }
    }

    console.log('\n================ MIGRATION SUMMARY ================');
    console.log(`Total checked: ${total}`);
    console.log(`Migrated: ${migrated}`);
    console.log(`Failed: ${failed}`);
    console.log('=================================================');
}

runMigration().catch((err) => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
});
