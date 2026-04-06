const validCollections = ["Devs Recommended", "Featured Carousel"];

if (!targetList || !validCollections.includes(targetList)) {
  print(`ERROR: targetList must be one of: ${validCollections.join(", ")}`);
  quit(1);
}

if (!fitgirlId) {
  print(`ERROR: fitgirlId is required`);
  quit(1);
}

// 1. Find the game in fitgirl-games using string fitgirl_id
const game = db['fitgirl-games'].findOne({ fitgirl_id: String(fitgirlId) });

if (!game) {
  print(`ERROR: No game found in 'fitgirl-games' with fitgirl_id: ${fitgirlId}`);
  quit(1);
}

// 2. Update the store-layouts document
const result = db['store-layouts'].updateOne(
  { name: 'LatestPage', "sections.title": targetList },
  { 
    $addToSet: { "sections.$.games": game._id },
    $set: { updatedAt: new Date() } 
  }
);

if (result.modifiedCount === 1) {
  print(`SUCCESS: '${game.gameName || game.title}' promoted to '${targetList}'`);
} else {
  // Check if it was because document wasn't found or already existed
  const layout = db['store-layouts'].findOne({ name: 'LatestPage', "sections.title": targetList });
  if (!layout) {
    print(`ERROR: Could not find 'LatestPage' document with section '${targetList}' in store-layouts`);
  } else {
    print(`INFO: '${game.gameName || game.title}' is already in '${targetList}'`);
  }
}