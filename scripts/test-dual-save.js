import { saveImageDual } from '../controllers/imageController.js';

// Dummy base64 image (tiny red dot)
const base64Image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function testDualSave() {
    console.log("🧪 Testing Dual Storage (Local + Cloud)...");
    try {
        const result = await saveImageDual(base64Image, "test_user", "test_context");
        console.log("✅ Result:", JSON.stringify(result, null, 2));
        if (result.success) {
            console.log("\n🎉 TEST PASSED: Image saved both locally and to Cloudinary!");
        } else {
            console.log("\n⚠️ TEST PARTIAL: Image saved locally but Cloudinary failed.");
        }
    } catch (err) {
        console.error("\n❌ TEST FAILED:", err.message);
    }
    process.exit(0);
}

testDualSave();
