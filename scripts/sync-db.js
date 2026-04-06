import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load Env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const getRawLocalUri = () => (process.env.MONGO_URI || "mongodb://teamuser:teampassword123@172.25.4.110:27017/?authSource=admin").trim();
const getRawAtlasUri = () => (process.env.ATLAS_MONGO_URI || "").trim();

// Robust Function to construct URI for a specific database without using 'new URL'
const buildUriForDb = (uri, dbName) => {
    const queryIndex = uri.indexOf('?');
    const basePart = queryIndex === -1 ? uri : uri.substring(0, queryIndex);
    const queryPart = queryIndex === -1 ? '' : uri.substring(queryIndex);
    const protocolEnd = basePart.indexOf('://') + 3;
    const slashIndex = basePart.indexOf('/', protocolEnd);
    const baseWithNoPath = slashIndex === -1 ? basePart : basePart.substring(0, slashIndex);
    return `${baseWithNoPath}/${dbName}${queryPart}`;
};

async function getDatabases(connection) {
    const admin = connection.db.admin();
    const result = await admin.listDatabases();
    return result.databases
        .map(db => db.name)
        .filter(name => !['admin', 'config', 'local'].includes(name));
}

// Helper to compare two objects by content (stringified)
const areDifferent = (a, b) => {
    const cleanA = { ...a };
    const cleanB = { ...b };
    delete cleanA.updatedAt;
    delete cleanB.updatedAt;
    delete cleanA.__v;
    delete cleanB.__v;
    return JSON.stringify(cleanA) !== JSON.stringify(cleanB);
};

export async function syncDbs() {
    console.log("🔄 Starting Fully Dynamic Bidirectional Sync...");
    
    // Refresh env in case it changed during the process
    dotenv.config({ path: path.join(__dirname, '../.env') });
    const rawLocalUri = getRawLocalUri();
    const rawAtlasUri = getRawAtlasUri();

    if (!rawAtlasUri || rawAtlasUri.includes('your_atlas_connection_string_here')) {
        console.error("❌ Missing or default ATLAS_MONGO_URI in .env file.");
        return;
    }

    try {
        const [tempLocal, tempAtlas] = await Promise.all([
            mongoose.createConnection(rawLocalUri, { serverSelectionTimeoutMS: 5000 }).asPromise(),
            mongoose.createConnection(rawAtlasUri, { serverSelectionTimeoutMS: 5000 }).asPromise()
        ]);

        const localDbs = await getDatabases(tempLocal);
        const atlasDbs = await getDatabases(tempAtlas);
        
        await Promise.all([tempLocal.close(), tempAtlas.close()]);

        const allDbs = new Set([...localDbs, ...atlasDbs]);
        console.log(`📂 Found ${allDbs.size} databases to sync: ${Array.from(allDbs).join(', ')}`);

        const summary = [];

        for (const dbName of allDbs) {
            console.log(`\n==============================================`);
            console.log(`🌐 Syncing Database Namespace: [${dbName.toUpperCase()}]`);
            console.log(`==============================================`);

            const localUri = buildUriForDb(rawLocalUri, dbName);
            const atlasUri = buildUriForDb(rawAtlasUri, dbName);

            const [localConnection, atlasConnection] = await Promise.all([
                mongoose.createConnection(localUri, { serverSelectionTimeoutMS: 5000 }).asPromise(),
                mongoose.createConnection(atlasUri, { serverSelectionTimeoutMS: 5000 }).asPromise()
            ]);
            
            const localDb = localConnection.db;
            const atlasDb = atlasConnection.db;
            
            const [localCols, atlasCols] = await Promise.all([
                localDb.listCollections().toArray(),
                atlasDb.listCollections().toArray()
            ]);
            
            const allCollectionNames = new Set([
                ...localCols.map(c => c.name),
                ...atlasCols.map(c => c.name)
            ]);
            
            for (const colName of allCollectionNames) {
                if (colName.startsWith('system.')) continue;
                
                console.log(`📦 Syncing collection: ${dbName}.${colName}`);
                
                const localCol = localDb.collection(colName);
                const atlasCol = atlasDb.collection(colName);
                
                const [localDocs, atlasDocs] = await Promise.all([
                    localCol.find({}).toArray(),
                    atlasCol.find({}).toArray()
                ]);
                
                const localDocMap = new Map();
                localDocs.forEach(doc => localDocMap.set(doc._id.toString(), doc));
                
                const atlasDocMap = new Map();
                atlasDocs.forEach(doc => atlasDocMap.set(doc._id.toString(), doc));
                
                const allIds = new Set([...localDocMap.keys(), ...atlasDocMap.keys()]);
                
                const localBulkOps = [];
                const atlasBulkOps = [];
                let stats = { insertedAtlas: 0, insertedLocal: 0, updatedAtlas: 0, updatedLocal: 0 };
                
                for (const id of allIds) {
                    const localDoc = localDocMap.get(id);
                    const atlasDoc = atlasDocMap.get(id);
                    
                    if (localDoc && !atlasDoc) {
                        atlasBulkOps.push({ insertOne: { document: localDoc } });
                        stats.insertedAtlas++;
                    } 
                    else if (!localDoc && atlasDoc) {
                        localBulkOps.push({ insertOne: { document: atlasDoc } });
                        stats.insertedLocal++;
                    } 
                    else if (localDoc && atlasDoc) {
                        const localTime = localDoc.updatedAt ? new Date(localDoc.updatedAt).getTime() : 0;
                        const atlasTime = atlasDoc.updatedAt ? new Date(atlasDoc.updatedAt).getTime() : 0;
                        
                        if (localTime > atlasTime) {
                            atlasBulkOps.push({ replaceOne: { filter: { _id: atlasDoc._id }, replacement: localDoc } });
                            stats.updatedAtlas++;
                        } 
                        else if (atlasTime > localTime) {
                            localBulkOps.push({ replaceOne: { filter: { _id: localDoc._id }, replacement: atlasDoc } });
                            stats.updatedLocal++;
                        }
                        else if (areDifferent(localDoc, atlasDoc)) {
                            atlasBulkOps.push({ replaceOne: { filter: { _id: atlasDoc._id }, replacement: localDoc } });
                            stats.updatedAtlas++;
                        }
                    }
                }
                
                if (localBulkOps.length > 0) {
                    await localCol.bulkWrite(localBulkOps);
                }
                if (atlasBulkOps.length > 0) {
                    await atlasCol.bulkWrite(atlasBulkOps);
                }
                
                console.log(`   └─ Local: +${stats.insertedLocal} inserted, ~${stats.updatedLocal} updated.`);
                console.log(`   └─ Atlas: +${stats.insertedAtlas} inserted, ~${stats.updatedAtlas} updated.`);
                
                summary.push({
                    Database: dbName,
                    Collection: colName,
                    "Added to Local": stats.insertedLocal,
                    "Added to Atlas": stats.insertedAtlas,
                    "Updated in Local": stats.updatedLocal,
                    "Updated in Atlas": stats.updatedAtlas
                });
            }
            
            await Promise.all([localConnection.close(), atlasConnection.close()]);
        }
        
        console.log("\n================ SYNC SUMMARY ================");
        console.table(summary);
        console.log("==============================================");
        console.log("🎉 Dynamic Sync completed successfully!");
    } catch (err) {
        console.error("❌ Sync Error:", err);
    }
}

// Allow CLI execution
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    syncDbs().catch(err => {
        console.error("❌ Sync CLI Error:", err);
        process.exit(1);
    });
}
