import fs from 'fs';

import path from 'path';



export const handleExternalUpload = (req, res) => {

    try {

        const secret = req.headers['x-storage-secret'];

        if (!secret || secret !== process.env.STORAGE_SERVER_SECRET) {

            return res.status(401).json({ message: "Unauthorized storage access" });

        }



        // 1. CRITICAL FIX: Get the filename from the body so it matches CrackStore

        const { base64Image, folderId, context, filename: incomingFilename } = req.body;



        if (!base64Image || !folderId) {

            return res.status(400).json({ message: "Missing required payload parameters" });

        }



        const matches = base64Image.match(/^data:([^;]+);base64,(.+)$/);

        if (!matches) {

            return res.status(400).json({ message: "Invalid image format" });

        }



        const ext = matches[1].split('/').pop();

        const base64Data = matches[2];



        // 2. STABILITY FIX: Use absolute paths to ensure it saves in the project folder

        const rootDir = process.cwd();

        const userFolder = path.join(rootDir, 'public', folderId.toString(), context || 'misc');



        if (!fs.existsSync(userFolder)) {

            fs.mkdirSync(userFolder, { recursive: true });

        }



        // 3. SYNC FIX: Priority to the filename sent by the backend

        const filename = incomingFilename || (context === 'profile' ? `profile.${ext}` : `img_${Date.now()}.${ext}`);

        const filePath = path.join(userFolder, filename);



        // 4. Write the file safely

        fs.writeFileSync(filePath, base64Data, 'base64');



        res.status(200).json({

            success: true,

            path: `/public/${folderId}/${context || 'misc'}/${filename}`

        });



    } catch (error) {

        // 5. DEBUG FIX: This will show the REAL error in his terminal

        console.error("CRITICAL STORAGE ERROR:", error);

        res.status(500).json({ message: "Internal server error saving file", debug: error.message });

    }

};