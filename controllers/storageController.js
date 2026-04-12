import cloudinary from '../configs/cloudinary.js';
import { containerClient, uploadToAzure } from '../configs/azureStorage.js';
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

        console.log(`📦 Azure: Uploading image for folder ${folderId}...`);

        // 1. Prepare Data
        const imageMatch = base64Image.match(/^data:image\/(\w+);base64,(.+)$/);
        const fallbackMatch = base64Image.match(/^data:application\/octet-stream;base64,(.+)$/);
        const ext = imageMatch ? imageMatch[1] : 'png';
        const rawBase64 = imageMatch ? imageMatch[2] : fallbackMatch ? fallbackMatch[1] : base64Image;
        const buffer = Buffer.from(rawBase64, 'base64');
        const fileName = `${folderId}/${context || 'misc'}/${incomingFilename || `file_${Date.now()}.${ext}`}`;

        // 2. Upload to Azure (Primary)
        const azureUrl = await uploadToAzure(buffer, fileName, `image/${ext}`);
        console.log(`✅ Azure: Upload successful! URL: ${azureUrl}`);

        // 3. Upload to Cloudinary (Backup/Secondary)
        try {
            await cloudinary.uploader.upload(base64Image, {
                folder: `crackstore/${folderId}/${context || 'misc'}`,
                public_id: incomingFilename ? path.parse(incomingFilename).name : undefined,
                resource_type: 'auto'
            });
            console.log(`✅ Cloudinary: Backup successful!`);
        } catch (cErr) {
            console.warn(`⚠️ Cloudinary backup failed (non-critical):`, cErr.message);
        }

        // 4. Return the Azure URL
        res.status(200).json({
            success: true,
            path: azureUrl, // Azure is now the primary source!
            provider: 'azure'
        });

    } catch (error) {
        console.error("❌ STORAGE ERROR:", error);
        res.status(500).json({ 
            message: "Internal server error saving file to azure", 
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

/**
 * Proxy/Bridge for viewing Azure images.
 */
export const proxyAzureImage = async (req, res) => {
    try {
        const { blobName } = req.query; // blobName: "userId/context/filename.ext"

        if (!blobName) {
            return res.status(400).json({ message: "Missing blobName parameter" });
        }

        console.log(`🌐 Proxying request for Azure Blob: ${blobName}`);

        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        
        const downloadResponse = await blockBlobClient.download(0);
        
        res.setHeader('Content-Type', downloadResponse.contentType);
        downloadResponse.readableStreamBody.pipe(res);

    } catch (error) {
        console.error("❌ AZURE PROXY ERROR:", error);
        res.status(500).json({ message: "Error bridging Azure image request" });
    }
};