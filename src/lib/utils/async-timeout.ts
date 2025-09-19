const DEFAULT_TIMEOUT_MESSAGE = 'Operation timed out';

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Executes an async operation with an AbortController-based timeout.
 * Aborts the underlying request when the timeout elapses and throws a TimeoutError.
 */
export async function executeWithTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = DEFAULT_TIMEOUT_MESSAGE
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await operation(controller.signal);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : undefined;
    const aborted = errorName === 'AbortError' || /(?:aborted|abort)/i.test(errorMessage);
    if (aborted) {
      throw new TimeoutError(timeoutMessage);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
