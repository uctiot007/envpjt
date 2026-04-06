const validCollections = ["Devs Recommended", "Featured Carousel"];

if (!targetList || !validCollections.includes(targetList)) {
  print(`ERROR: targetList must be one of: ${validCollections.join(", ")}`);
  quit(1);
}

if (!fitgirlId) {
  print(`ERROR: fitgirlId is required`);
  quit(1);
}

// 1. Find the game in fitgirl-games
const game = db['fitgirl-games'].findOne({ fitgirl_id: String(fitgirlId) });

if (!game) {
  print(`ERROR: No game found in 'fitgirl-games' with fitgirl_id: ${fitgirlId}`);
  quit(1);
}

// 2. Remove the _id from the appropriate section array
const result = db['store-layouts'].updateOne(
  { name: 'LatestPage', "sections.title": targetList },
  { 
    $pull: { "sections.$.games": game._id },
    $set: { updatedAt: new Date() } 
  }
);

if (result.modifiedCount === 1) {
  print(`SUCCESS: '${game.gameName || game.title}' removed from '${targetList}'`);
} else {
  print(`INFO: '${game.gameName || game.title}' was not in '${targetList}'`);
}