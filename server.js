import express from 'express';
import serveStatic from 'serve-static';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080; // Use port provided by environment or default to 8080

// Serve static files from the root of the project
// This tells the server to look for files like index.html, app.js, style.css etc.
// directly in the current directory.
app.use(serveStatic(__dirname));

// For single-page applications, serve index.html for all routes
// This ensures that refreshing a deep link or direct access to a sub-path
// will still load your SPA, and your client-side router (if any) can take over.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Dream Weaver server listening on port ${port}`);
});
