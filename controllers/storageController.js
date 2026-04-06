import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load Env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

export const handleExternalUpload = async (req, res) => {
    try {
        const secret = req.headers['x-storage-secret'];
        if (!secret || secret !== process.env.STORAGE_SERVER_SECRET) {
            return res.status(401).json({ message: "Unauthorized storage access" });
        }

        const { base64Image, folderId, context, filename: incomingFilename } = req.body;

        if (!base64Image || !folderId) {
            return res.status(400).json({ message: "Missing required payload parameters" });
        }

        console.log(`☁️ Cloudinary: Uploading image for folder ${folderId}...`);

        // 1. Upload to Cloudinary
        // We pass the base64 string directly (Cloudinary handles the data:image prefix)
        const uploadResponse = await cloudinary.uploader.upload(base64Image, {
            folder: `crackstore/${folderId}/${context || 'misc'}`,
            public_id: incomingFilename ? path.parse(incomingFilename).name : undefined,
            resource_type: 'auto'
        });

        console.log(`✅ Cloudinary: Upload successful! URL: ${uploadResponse.secure_url}`);

        // 2. Return the permanent Secure URL
        res.status(200).json({
            success: true,
            path: uploadResponse.secure_url, // This is now a permanent global link!
            public_id: uploadResponse.public_id
        });

    } catch (error) {
        console.error("❌ CLOUDINARY STORAGE ERROR:", error);
        res.status(500).json({ 
            message: "Internal server error saving file to cloud", 
            debug: error.message 
        });
    }
};