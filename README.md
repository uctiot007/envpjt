# envpjt — Node.js REST API Backend

A modular, production-ready REST API backend built with **Express.js** and **MongoDB (Mongoose)**. The project follows the MVC (Model-View-Controller) pattern and ships with JWT authentication, email notifications, real-time support via Socket.IO, dual-layer cloud media storage, and a smart automated boot sequence.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Smart Boot Sequence](#smart-boot-sequence)
- [Triple Storage System](#triple-storage-system)
- [Cloudinary & Azure Proxy Bridges](#cloudinary--azure-proxy-bridges)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Backend Implementation Guide (Cloudinary & Azure)](#backend-implementation-guide-cloudinary--azure)
- [API Overview](#api-overview)
- [Contributing](#contributing)

---

## Features

- **RESTful API**: Modular routing and controllers for clean organization.
- **Smart Boot Sequence**: Automatically detects LAN IP, syncs MongoDB databases, and mirrors assets to the cloud on every startup.
- **Dual Storage System**: Saves all media both locally (disk) and to Cloudinary for maximum redundancy.
- **Cloudinary Proxy Bridge**: Bypasses network restrictions (like college firewalls) by serving cloud images through your own server.
- **JWT Authentication**: Secure token-based auth with middleware.
- **Real-time Events**: Integrated Socket.IO for live messaging.
- **Email Service**: Automated notifications via Nodemailer.
- **Database Maintenance**: Built-in bidirectional sync and backup scripts.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (ESM modules) |
| Framework | Express.js 4 |
| Database | MongoDB + Mongoose |
| Image Storage | Cloudinary 2 + Azure Blob + Local Storage |
| Real-time | Socket.IO 4 |
| Auth | JWT + bcryptjs |
| Dev tooling | Nodemon (configured to ignore boot meta-changes) |

---

## Project Structure

```
envpjt/
├── configs/          # Database and Cloudinary configuration
├── controllers/      # Business logic (message, user, storage, etc.)
├── models/           # Mongoose schemas (Dual storage fields added)
├── routes/           # Express route definitions
├── scripts/
│   ├── boot-sync.js  # Main startup orchestration logic
│   ├── sync-db.js    # Multi-database bidirectional sync
│   └── test-cloud.js # Cloudinary connection diagnostics
├── utils/            # Shared utilities (Asset sync, Token generation)
├── server.js         # Entry point (Triggers boot sequence)
├── .env              # Environment vars
└── nodemon.json      # Custom settings to prevent boot-loops
```

---

## Smart Boot Sequence

When you run `npm run dev` or `npm start`, the server executes a **Smart Boot Sequence** before opening the port:
1. **LAN IP Detection**: Finds your current IPv4 and updates `.env` (crucial for local MongoDB connections).
2. **IP Logging**: Logs the machine hostname and new IP to the `Server.IPinfo` database.
3. **Database Sync**: Performs a bidirectional sync between your Local MongoDB and MongoDB Atlas across multiple namespaces.
4. **Local Backup**: Creates a point-in-time JSON backup of your local collections.
5. **Asset Mirroring**: Scans the `public/` directory and ensures all new local files are mirrored to Cloudinary.

---

## Triple Storage System

The application implements a "Triple Storage" strategy for all media. Use the `saveImageMulti` utility in your controllers to:
- Save a high-resolution copy to the server's local disk.
- Upload that same image to Cloudinary.
- Upload that same image to **Azure Blob Storage**.
- **Schema**: Models now include `profilePicLocal`, `profilePicCloud`, and `profilePicAzure` fields.
- **Priority**: Azure is the primary storage provider. The `profilePic` and `image` fields will favor Azure URLs if available.

---

## Cloudinary & Azure Proxy Bridges

If cloud domains are blocked (common in restricted networks), use the **Proxy Bridges**:
- **Cloudinary Endpoint**: `GET /api/storage/view?publicId=...&folderId=...&context=...`
- **Azure Endpoint**: `GET /api/storage/azure/view?blobName=...`
- **How it works**: Your backend fetches the image from the cloud provider and streams it directly to the browser.
- **Benefit**: Users behind firewalls can see the cloud images via your Render/Production domain.

---

## Available Scripts

The scripts are now simplified. The server handles all maintenance tasks automatically on start.

> Both `npm start` and `npm run dev` now execute Azure connectivity verification first, then start the server.

| Script | Command | Description |
|---|---|---|
| **Start (Dev)** | `npm run dev` | Runs Azure connectivity test, then starts the server with Nodemon |
| **Start (Prod)** | `npm start` | Runs Azure connectivity test, then starts the server |
| **Direct Boot** | `npm run boot` | Manually trigger host-sync and asset-mirroring |
| **DB Sync** | `npm run sync` | Manually trigger bidirectional database sync |

---

## Backend Implementation Guide (Cloudinary API)

This section explains how to implement and use the Cloudinary "Proxy and Dual-Save" system for new backend features.

### 1. The Dual-Saving Logic
To implement a "Dual Storage" endpoint, you must handle both local file I/O and the Cloudinary SDK concurrently.

```javascript
// Located in controllers/imageController.js
export const saveImageDual = async (base64Image, userId, context) => {
    // 1. Save locally using fs.writeFileSync
    const localUrl = saveImageLocally(base64Image, userId, context);

    // 2. Upload to Cloudinary using the SDK
    try {
        const uploadResponse = await cloudinary.uploader.upload(base64Image, {
            folder: `crackstore/${userId}/${context}`,
            public_id: path.parse(localUrl).name,
            resource_type: 'auto'
        });
        return { localUrl, cloudUrl: uploadResponse.secure_url, success: true };
    } catch (err) {
        return { localUrl, cloudUrl: null, success: false }; // Local only fallback
    }
};
```

### 2. Implementing the Proxy Bridge
To allow your backend to act as a bridge for cloud assets, implement a streaming route:

```javascript
// Located in controllers/storageController.js
export const proxyCloudinaryImage = async (req, res) => {
    const { publicId, folderId, context } = req.query;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    
    // Construct the direct Cloudinary URL
    const imageUrl = `https://res.cloudinary.com/${cloudName}/image/upload/crackstore/${folderId}/${context}/${publicId}`;

    // Fetch the image from the server (Server has unrestricted network access)
    const response = await fetch(imageUrl);
    
    // Stream the image data directly to the client
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    res.setHeader('Content-Type', response.headers.get('content-type'));
    res.send(buffer);
};
```

### 3. Usage in Routes
Always ensure your startup sequence doesn't loop. If you modify files on boot, configure **Nodemon** with an ignore list:
```json
{
  "ignore": [".env", "backups/*", "*_log.txt", "public/*"]
}
```

### 4. Azure Blob Storage Integration
For backend developers who need Azure as the primary image database, wire the Azure helper and route as follows:

1. **Environment variables**
   - `AZURE_STORAGE_CONNECTION_STRING` — Azure Storage account connection string
   - `AZURE_CONTAINER_NAME` — blob container name (example: `mystorage123`)
   - `STORAGE_SERVER_SECRET` — secret used for `/api/storage/upload`

2. **Azure helper setup**
   - In `configs/azureStorage.js`, the `uploadToAzure()` helper should create the container if missing and upload image buffers.
   - Export `uploadToAzure` and `containerClient` for controller usage.

3. **Upload endpoint**
   - `routes/storageApi.js` exposes `POST /api/storage/upload`
   - `controllers/storageController.js` implements `handleExternalUpload()`
   - It validates `x-storage-secret`, parses `base64Image`, and uploads to Azure first.

4. **Image controller usage**
   - Use `saveImageMulti(base64Image, userId, context)` in any controller that saves user or message images.
   - It returns an object with:
     - `localUrl`
     - `cloudUrl`
     - `azureUrl`
     - `success` status for each storage provider

5. **Select the correct frontend URL**
   - Prefer Azure for the public-facing field.
   - Example in `controllers/userControllers.js`:
     ```js
     const primaryUrl = result.azureUrl || result.cloudUrl || result.localUrl;
     ```
   - Store secondary values in separate DB fields:
     - `profilePicLocal`
     - `profilePicCloud`
     - `profilePicAzure`

### 5. Verification checklist for backend integration
- `node .\scripts\test-azure.js` returns successful Azure connectivity.
- `POST /api/storage/upload` returns `success: true` and a valid Azure URL.
- `profilePicAzure` or `imageAzure` is populated in MongoDB after upload.
- `GET /api/storage/azure/view?blobName=...` streams the blob back correctly.
- `saveImageMulti(...)` is used in controllers rather than direct local-only saves.

---

## Installation

1. **Clone & Install**
   ```bash
   npm install
   ```

2. **Environment Setup**
   Ensure the following values are set in `.env`:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `AZURE_STORAGE_CONNECTION_STRING`
   - `AZURE_CONTAINER_NAME`
   - `STORAGE_SERVER_SECRET`

3. **Run**
   ```bash
   npm run dev
   ```

---

## License

This project is currently private.
