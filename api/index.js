import serverless from 'serverless-http';

// Disable Vercel's built-in body parser so express.json() inside the app
// handles parsing (serverless-http adapts the raw request for express).
export const config = {
  api: {
    bodyParser: false,
  },
};

// Lazily load the Express app and wrap it with serverless-http. Doing this
// inside the handler (instead of at module top-level) means any error thrown
// while loading/initialising the app is caught here and turned into a clean
// JSON response — otherwise an uncaught module-load error makes Vercel return
// its opaque {"code":500,"message":"A server error has occurred"} and we get
// no diagnostic. The promise is cached so the app is only loaded once per
// warm lambda instance.
let handlerPromise = null;
function getHandler() {
  if (!handlerPromise) {
    handlerPromise = import('../server/index.js').then((m) => serverless(m.default));
  }
  return handlerPromise;
}

export default async function (req, res) {
  try {
    const handler = await getHandler();
    return await handler(req, res);
  } catch (err) {
    console.error('[lambda] uncaught error:', err);
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        error: '服务器内部错误：' + (err && err.message ? err.message : 'unknown error'),
      }),
    };
  }
}
