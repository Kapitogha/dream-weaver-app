import express from 'express';
import serveStatic from 'serve-static';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080; // Use port provided by environment or default to 8080

// Serve static files from the 'public' directory
const publicPath = path.join(__dirname, 'public');
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
