import serverless from 'serverless-http';
import app from '../server/index.js';

// Disable Vercel's built-in body parser so express.json() inside the app
// handles parsing (serverless-http adapts the raw request for express).
export const config = {
  api: {
    bodyParser: false,
  },
};

export default serverless(app);
