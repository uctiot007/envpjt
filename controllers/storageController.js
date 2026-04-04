import fs from 'fs';
import path from 'path';

export const handleExternalUpload = (req, res) => {
    try {
        const secret = req.headers['x-storage-secret'];
        if (!secret || secret !== process.env.STORAGE_SERVER_SECRET) {
            return res.status(401).json({ message: "Unauthorized storage access" });
        }

        const { base64Image, folderId, context } = req.body;
        
        if (!base64Image || !folderId) {
            return res.status(400).json({ message: "Missing required payload parameters" });
        }

        const matches = base64Image.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!matches) {
            return res.status(400).json({ message: "Invalid image format" });
        }

        const ext = matches[1];
        const base64Data = matches[2];

        // Folder logic: public/userId/context
        const userFolder = path.join('public', folderId.toString(), context || 'misc');
        if (!fs.existsSync(userFolder)) {
            fs.mkdirSync(userFolder, { recursive: true });
        }

        const filename = context === 'profile' 
            ? `profile.${ext}` 
            : `img_${Date.now()}.${ext}`;

        const filePath = path.join(userFolder, filename);
        fs.writeFileSync(filePath, base64Data, 'base64');

        // Return the path
        res.status(200).json({ 
            success: true, 
            path: `/public/${folderId}/${context || 'misc'}/${filename}`
        });

    } catch (error) {
        console.error("Storage server write error:", error);
        res.status(500).json({ message: "Internal server error saving file" });
    }
};
