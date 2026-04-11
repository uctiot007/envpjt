import { syncAssets } from '../utils/asset-sync.js';

/**
 * Legacy script refactored to use the new centralized utility.
 */
async function migrate() {
    await syncAssets();
    console.log("🎉 Migration finished! Check your Cloudinary Dashboard.");
}

migrate();
