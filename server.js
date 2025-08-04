import express from 'express';
import serveStatic from 'serve-static';
import path from 'path';
import fs from 'fs/promises'; // For reading files
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080; // Use port provided by environment or default to 8080

// Define the path to your static files (e.g., index.html, app.js, style.css)
const publicPath = path.join(__dirname, 'public');

// Special route for the root (index.html) to inject Firebase config
app.get('/', async (req, res) => {
  try {
    // Read the index.html file from the public directory
    let indexHtml = await fs.readFile(path.join(publicPath, 'index.html'), 'utf8');

    // Get Firebase config from environment variables (provided by apphosting.yaml)
    const firebaseConfig = {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MessAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID,
      measurementId: process.env.FIREBASE_MEASUREMENT_ID // Optional
    };

    // Convert the Firebase config object to a JSON string
    const firebaseConfigJson = JSON.stringify(firebaseConfig);

    // Replace the placeholder in index.html with the actual Firebase config script
    indexHtml = indexHtml.replace(
      '<!-- FIREBASE_CONFIG_PLACEHOLDER -->',
      `<script>window.firebaseConfig = ${firebaseConfigJson};</script>`
    );

    // Send the modified index.html back to the browser
    res.send(indexHtml);
  } catch (error) {
    console.error("Error serving index.html with Firebase config:", error);
    res.status(500).send("Server Error");
  }
});

// Serve other static files from the 'public' directory
// This ensures that your app.js, ui-utils.js, etc., are served correctly.
app.use(serveStatic(publicPath));

// For single-page applications, serve index.html for all other routes
// This handles cases where a user directly accesses a sub-path (e.g., /dreams)
// and ensures your client-side routing takes over.
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(port, () => {
  console.log(`Dream Weaver server listening on port ${port}`);
});
