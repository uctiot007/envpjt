import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cloudinary from '../configs/cloudinary.js';
import { containerClient } from '../configs/azureStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// context: 'profile' | 'message'
export const saveImageLocally = (base64Image, userId, context = 'message') => {
    const matches = base64Image.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) throw new Error("Invalid image format");

    const ext = matches[1];
    const base64Data = matches[2];

    const userFolder = path.join('public', userId.toString(), context);
    if (!fs.existsSync(userFolder)) {
        fs.mkdirSync(userFolder, { recursive: true });
    }

    const filename = context === 'profile' 
        ? `profile.${ext}` 
        : `img_${Date.now()}.${ext}`;

    const filePath = path.join(userFolder, filename);
    fs.writeFileSync(filePath, base64Data, 'base64');

    return `/${userId}/${context}/${filename}`;  // URL path to serve
};

/**
 * Saves image to Triple Storage: Local, Cloudinary, and Azure Blob Storage.
 * Azure is the prioritized cloud provider.
 */
export const saveImageMulti = async (base64Image, userId, context = 'message') => {
    // 1. Save Locally
    const localUrl = saveImageLocally(base64Image, userId, context);
    const results = {
        localUrl,
        cloudUrl: null,
        azureUrl: null,
        success: { local: true, cloud: false, azure: false }
    };

    // 2. Upload to Cloudinary
    try {
        const publicId = path.parse(localUrl).name;
        const uploadResponse = await cloudinary.uploader.upload(base64Image, {
            folder: `crackstore/${userId}/${context}`,
            public_id: publicId,
            resource_type: 'auto'
        });
        results.cloudUrl = uploadResponse.secure_url;
        results.success.cloud = true;
    } catch (err) {
        console.error("⚠️ Cloudinary Upload Failed:", err.message);
    }

    // 3. Upload to Azure Blob Storage
    try {
        const matches = base64Image.match(/^data:image\/(\w+);base64,(.+)$/);
        const ext = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const fileName = `${userId}/${context}/${path.parse(localUrl).name}.${ext}`;
        
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);
        
        await blockBlobClient.uploadData(buffer, {
            blobHTTPHeaders: { blobContentType: `image/${ext}` }
        });

        results.azureUrl = blockBlobClient.url;
        results.success.azure = true;
        console.log(`✅ Azure: Upload successful! URL: ${results.azureUrl}`);
    } catch (err) {
        console.error("⚠️ Azure Blob Storage Upload Failed:", err.message);
    }

    return results;
};

// Keeping for backward compatibility (maps to Multi now)
export const saveImageDual = saveImageMulti;