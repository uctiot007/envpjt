const validCollections = ["Devs Recommended", "Featured Carousel"];

if (!targetList || !validCollections.includes(targetList)) {
  print(`ERROR: targetList must be one of: ${validCollections.join(", ")}`);
  quit(1);
}

// Clear the array instead of deleting documents from a collection
const result = db['store-layouts'].updateOne(
  { name: 'LatestPage', "sections.title": targetList },
  { $set: { "sections.$.games": [], updatedAt: new Date() } }
);

if (result.modifiedCount > 0) {
  print(`SUCCESS: Cleared all games from '${targetList}' in store-layouts.`);
} else {
  print(`INFO: '${targetList}' is already empty or could not be found.`);
}
