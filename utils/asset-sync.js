import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cloudinary from '../configs/cloudinary.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const publicDir = path.join(__dirname, '..', 'public');

/**
 * Scans the public directory and uploads all files to Cloudinary.
 * Mirroring the logic from migrate-to-cloud.js but in a reusable utility.
 */
export async function syncAssets() {
    console.log("\n🚀 Starting Cloud Asset Synchronization...");
    console.log(`📁 Scanning local public directory: ${publicDir}`);

    if (!fs.existsSync(publicDir)) {
        console.warn("⚠️ WARNING: Local public directory not found. Skipping asset sync.");
        return;
    }

    const getAllFiles = (dirPath, arrayOfFiles) => {
        const files = fs.readdirSync(dirPath);
        arrayOfFiles = arrayOfFiles || [];

        files.forEach((file) => {
            if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
                arrayOfFiles = getAllFiles(path.join(dirPath, file), arrayOfFiles);
            } else {
                arrayOfFiles.push(path.join(dirPath, file));
            }
        });

        return arrayOfFiles;
    };

    const files = getAllFiles(publicDir);
    console.log(`📦 Found ${files.length} assets to check.`);

    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;

    const useProxy = process.env.PROXIED_SYNC === 'true';
    if (useProxy) {
        console.log(`🔗 Proxy Mode Enabled: Using Render bridge at ${process.env.RENDER_URL}`);
    }

    const uploadToCloudinary = async (filePath, folderPath, publicId, relativePath) => {
        if (useProxy) {
            return await uploadViaProxy(filePath, folderPath, publicId, relativePath);
        } else {
            return await uploadDirect(filePath, folderPath, publicId, relativePath);
        }
    };

    const uploadDirect = async (filePath, folderPath, publicId, relativePath) => {
        try {
            await cloudinary.uploader.upload(filePath, {
                folder: folderPath,
                public_id: publicId,
                resource_type: 'auto',
                invalidate: true
            });
            return { success: true, type: 'auto' };
        } catch (err) {
            if (err.message.includes('Invalid image file') || err.message.includes('not a valid image')) {
                console.log(`   🔄 Retrying ${relativePath} as 'raw' resource...`);
                await cloudinary.uploader.upload(filePath, {
                    folder: folderPath,
                    public_id: publicId,
                    resource_type: 'raw',
                    invalidate: true
                });
                return { success: true, type: 'raw' };
            }
            throw err;
        }
    };

    const uploadViaProxy = async (filePath, folderPath, publicId, relativePath) => {
        const renderUrl = process.env.RENDER_URL;
        const secret = process.env.STORAGE_SERVER_SECRET;

        if (!renderUrl || renderUrl.includes('your-app-on-render')) {
            throw new Error("RENDER_URL not configured in .env");
        }

        // 1. Read file and convert to Base64
        const fileBuffer = fs.readFileSync(filePath);
        const base64Image = `data:image/${path.extname(filePath).slice(1)};base64,${fileBuffer.toString('base64')}`;

        // 2. Identify context (from folder structure)
        const parts = relativePath.split(path.sep);
        const folderId = parts[0];
        const context = parts[1] || 'misc';

        // 3. Post to Render Proxy
        const response = await fetch(`${renderUrl}/api/storage/upload`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-storage-secret': secret
            },
            body: JSON.stringify({
                base64Image,
                folderId,
                context,
                filename: path.basename(filePath)
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || `Proxy error: ${response.status}`);
        }
        return { success: true, proxied: true };
    };

    for (const filePath of files) {
        const relativePath = path.relative(publicDir, filePath);
        const folderPath = path.join('crackstore', path.dirname(relativePath)).replace(/\\/g, '/');
        const filename = path.basename(filePath);
        const publicId = path.parse(filename).name;

        try {
            const result = await uploadToCloudinary(filePath, folderPath, publicId, relativePath);
            successCount++;
            if (result.proxied) {
                // console.log(`   ✅ Proxied via Render: ${relativePath}`);
            } else if (result.type === 'raw') {
                console.log(`   ✅ Synced as raw data.`);
            }
        } catch (err) {
            console.error(`   ❌ Failed to sync ${relativePath}: ${err.message}`);
            failCount++;
        }
    }

    console.log("\n================ ASSET SYNC SUMMARY ================");
    console.log(`✅ Successfully synced: ${successCount}`);
    console.log(`⏩ Skipped/Up-to-date: ${skipCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log("====================================================");
}
