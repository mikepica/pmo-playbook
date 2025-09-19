const DEFAULT_KEEP_ALIVE_INTERVAL = 15000; // 15 seconds to stay below common 60s proxy timeouts

export interface StreamJsonResponseOptions {
  /**
   * How often to send whitespace keep-alive heartbeats (ms).
   * Defaults to 15 seconds which is safely below common 60s reverse-proxy limits.
   */
  keepAliveIntervalMs?: number;
  /**
   * Allows adding extra headers on the response.
   */
  headers?: Record<string, string>;
  /**
   * Optional status code for the response. Useful for pre-validation scenarios.
   * Runtime errors emitted from the handler cannot alter this status code because
   * the stream must start before the promise resolves, so callers should encode
   * error information inside the JSON payload when needed.
   */
  status?: number;
  /**
   * Custom error handler to convert thrown errors into JSON payloads. If omitted,
   * a generic error object is returned.
   */
  onError?: (error: unknown) => { body: unknown; status?: number };
  /**
   * Invoked once the handler completes successfully to adjust headers or perform
   * side-effects before the stream closes.
   */
  onComplete?: () => void;
}

export interface StreamJsonResult<T> {
  body: T;
  /**
   * Optional status code to include within the JSON payload. This does not change the
   * HTTP status but allows callers to surface semantic status to clients.
   */
  status?: number;
}

/**
 * Streams a JSON payload while regularly emitting whitespace heartbeats. This keeps
 * upstream proxies (e.g., NGINX with 60s timeouts) from terminating long-running
 * requests without requiring the consumer to change parsing logic: the response still
 * resolves to valid JSON once the stream closes.
 */
export function streamJsonResponse<T>(
  handler: () => Promise<StreamJsonResult<T>>,
  options: StreamJsonResponseOptions = {}
): Response {
  const keepAliveInterval = options.keepAliveIntervalMs ?? DEFAULT_KEEP_ALIVE_INTERVAL;
  const encoder = new TextEncoder();
  let keepAliveTimer: ReturnType<typeof setInterval> | undefined;

  const clearIntervalSafe = () => {
    if (keepAliveTimer) {
      clearInterval(keepAliveTimer);
      keepAliveTimer = undefined;
    }
  };

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(' '));
      keepAliveTimer = setInterval(() => {
        controller.enqueue(encoder.encode(' '));
      }, keepAliveInterval);

      try {
        const result = await handler();
        if (result?.body !== undefined) {
          controller.enqueue(encoder.encode(JSON.stringify(result.body)));
        }
        options.onComplete?.();
      } catch (error) {
        const fallback = options.onError?.(error) ?? {
          body: {
            error: 'An unexpected error occurred.',
            code: 'STREAM_HANDLER_ERROR'
          }
        };
        controller.enqueue(encoder.encode(JSON.stringify(fallback.body)));
      } finally {
        clearIntervalSafe();
        controller.close();
      }
    },
    cancel() {
      clearIntervalSafe();
    }
  });

  const headers: HeadersInit = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache',
    ...options.headers
  };

  return new Response(stream, {
    status: options.status ?? 200,
    headers
  });
}
