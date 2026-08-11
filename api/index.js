import serverless from 'serverless-http';

// Disable Vercel's built-in body parser so express.json() inside the app
// handles parsing (serverless-http adapts the raw request for express).
export const config = {
  api: {
    bodyParser: false,
  },
};

// Hard ceiling for the whole request. Vercel Hobby functions time out at 10s
// and then return an opaque {"code":504,"message":"An error occurred with your
// deployment"} with no clue about what hung. We race the handler against a 9s
// timer and, if anything inside the app stalls (a dead Upstash endpoint, a
// slow cold start, a hung outbound fetch, etc.), we still write a clean,
// diagnosable 500 to `res` BEFORE Vercel's 10s cutoff. NOTE: we must write to
// `res` directly — returning a {statusCode,...} object from a Vercel Node
// function using serverless-http (which drives req/res) is silently ignored,
// which is exactly why the earlier "controlled 500" never reached the client.
const HANDLER_TIMEOUT_MS = 20000;

// Lazily load the Express app and wrap it with serverless-http. Doing this
// inside the handler (instead of at module top-level) means any error thrown
// while loading/initialising the app is caught here. The promise is cached so
// the app is only loaded once per warm lambda instance.
let handlerPromise = null;
function getHandler() {
  if (!handlerPromise) {
    handlerPromise = Promise.race([
      import('../server/index.js').then((m) => serverless(m.default)),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('module load timed out')),
          HANDLER_TIMEOUT_MS
        )
      ),
    ]);
  }
  return handlerPromise;
}

function sendError(res, status, obj) {
  if (res.headersSent) return;
  res.status(status).json(obj);
}

export default async function (req, res) {
  const start = Date.now();
  const path = (req.url || '').split('?')[0];
  console.log(
    `[lambda] -> ${req.method || 'GET'} ${path} | VERCEL=${process.env.VERCEL || ''} UPSTASH=${process.env.UPSTASH_URL ? 'set' : 'unset'}`
  );

  let settled = false;
  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    console.error(`[lambda] TIMEOUT after ${Date.now() - start}ms on ${path}`);
    sendError(res, 500, {
      error: '请求处理超时（疑似外部服务无响应，已自动降级）',
      path,
      elapsedMs: Date.now() - start,
    });
  }, HANDLER_TIMEOUT_MS);

  try {
    const handler = await getHandler();
    const result = await handler(req, res);
    if (!settled) {
      settled = true;
      clearTimeout(timer);
      console.log(`[lambda] OK ${path} in ${Date.now() - start}ms`);
    }
    return result;
  } catch (err) {
    if (!settled) {
      settled = true;
      clearTimeout(timer);
      const elapsed = Date.now() - start;
      console.error(`[lambda] ERROR after ${elapsed}ms on ${path}:`, err);
      sendError(res, 500, {
        error:
          '服务器内部错误：' +
          (err && err.message ? err.message : 'unknown error'),
        reason: err && err.message ? err.message : 'unknown error',
        path,
        elapsedMs: elapsed,
      });
    }
    return;
  }
}
