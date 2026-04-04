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

const result = db[targetList].deleteOne({ _id: doc._id });

if (result.deletedCount === 1) {
  print(`SUCCESS: '${doc.title}' removed from '${targetList}' (all_games untouched)`);
} else {
  print(`INFO: '${doc.title}' was not present in '${targetList}' — nothing deleted`);
}