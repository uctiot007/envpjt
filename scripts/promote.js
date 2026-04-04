const validCollections = ["devs_recommended", "carousel"];

if (!targetList || !validCollections.includes(targetList)) {
  print(`ERROR: targetList must be one of: ${validCollections.join(", ")}`);
  quit(1);
}

if (!fitgirlId) {
  print(`ERROR: fitgirlId is required`);
  quit(1);
}

const doc = db.all_games.findOne({ fitgirl_id: parseInt(fitgirlId) });

if (!doc) {
  print(`ERROR: No document found in 'all_games' with fitgirl_id: ${fitgirlId}`);
  quit(1);
}

const { _id, ...fields } = doc;

const result = db[targetList].updateOne(
  { _id: doc._id },
  { $set: fields },
  { upsert: true }
);

if (result.upsertedCount === 1) {
  print(`SUCCESS: '${doc.title}' inserted into '${targetList}'`);
} else if (result.modifiedCount === 1) {
  print(`SUCCESS: '${doc.title}' updated in '${targetList}'`);
} else {
  print(`INFO: '${doc.title}' already up-to-date in '${targetList}'`);
}