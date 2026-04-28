tep 1: Install the dependencies

You'll need the official OpenAI SDK and Sharp.
Bash

npm install openai sharp

Step 2: The Moderation & Compression Service

Create a file called contentService.js (or wherever you keep your bot's logic). This function handles the entire pipeline.
JavaScript

import OpenAI from 'openai';
import sharp from 'sharp';

// Make sure OPENAI_API_KEY is in your .env or Woodpecker secrets
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
* Moderates text and image, then compresses the image if safe.
* @param {string} text - The user's Discord message
* @param {Buffer} imageBuffer - The raw image file from RAM
* @param {string} mimeType - e.g., 'image/png' or 'image/jpeg'
* @returns {Promise<Buffer>} - The compressed WebP buffer
  */
  export async function processSafeUpload(text, imageBuffer, mimeType) {
  // 1. Convert the RAM buffer to a Base64 Data URI for OpenAI
  const base64Image = imageBuffer.toString('base64');
  const dataUri = `data:${mimeType};base64,${base64Image}`;

// 2. Multimodal Moderation Check
const moderation = await openai.moderations.create({
model: "omni-moderation-latest",
input: [
{ type: "text", text: text || "No text provided" },
{ type: "image_url", image_url: { url: dataUri } }
]
});

const result = moderation.results[0];

// 3. The Bouncer
if (result.flagged) {
// You can inspect result.categories to see exactly WHAT they failed
console.warn("Blocked Content Categories:", result.categories);
throw new Error("VIOLATION_DETECTED");
}

// 4. The Compressor (Only runs if OpenAI gives the green light)
const optimizedWebPBuffer = await sharp(imageBuffer)
.resize({
width: 1024,
height: 1024,
fit: 'inside',
withoutEnlargement: true
})
.webp({ quality: 80 })
.toBuffer(); // We return it as a buffer so you can send it straight back to Discord

return optimizedWebPBuffer;
}

Step 3: Hooking it into your Bot/API

Now, wherever your endpoint or Discord interaction handler lives, you just call that one function. Because multer (or your Discord bot framework) holds the incoming file in memory, it never touches your hard drive.
JavaScript

import { processSafeUpload } from './contentService.js';

// Assuming an Express endpoint with multer memory storage
app.post('/upload-character', upload.single('image'), async (req, res) => {
try {
const userMessage = req.body.message || "";
const rawFileBuffer = req.file.buffer;
const mimeType = req.file.mimetype;

    // Run the gauntlet!
    const safeWebPBuffer = await processSafeUpload(userMessage, rawFileBuffer, mimeType);

    // If it passes, save it, upload it to an S3 bucket, or forward it to Discord!
    // Example: fs.writeFileSync('./uploads/safe-character.webp', safeWebPBuffer);

    res.json({ success: true, message: "Image is clean and compressed!" });

} catch (error) {
if (error.message === "VIOLATION_DETECTED") {
return res.status(403).json({ error: "Upload rejected by safety filters." });
}
res.status(500).json({ error: "Server error processing image." });
}
});

With this one file, you've completely insulated your bot. Racist text gets dropped, violent imagery gets dropped, and 5MB 4K PNGs get quietly crushed into 150KB WebP files before they are allowed anywhere near your permanent storage.
