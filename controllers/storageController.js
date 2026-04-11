import cloudinary from '../configs/cloudinary.js';
import path from 'path';

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

/**
 * Proxy/Bridge for viewing Cloudinary images.
 * Bypasses college network restrictions by fetching image on server.
 */
export const proxyCloudinaryImage = async (req, res) => {
    try {
        const { publicId, folderId, context } = req.query;

        if (!publicId) {
            return res.status(400).json({ message: "Missing publicId parameter" });
        }

        // Construct Cloudinary URL
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const pathParts = ['crackstore', folderId, context, publicId].filter(Boolean);
        const imageUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${pathParts.join('/')}`;

        console.log(`🌐 Proxying request for: ${imageUrl}`);

        const response = await fetch(imageUrl);

        if (!response.ok) {
            return res.status(response.status).json({ message: "Failed to fetch image from cloud" });
        }

        // Forward headers
        const contentType = response.headers.get('content-type');
        if (contentType) res.setHeader('Content-Type', contentType);
        
        const cacheControl = response.headers.get('cache-control');
        if (cacheControl) res.setHeader('Cache-Control', cacheControl);

        // Pipe the body
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        res.send(buffer);

    } catch (error) {
        console.error("❌ PROXY ERROR:", error);
        res.status(500).json({ message: "Error bridging image request" });
    }
};