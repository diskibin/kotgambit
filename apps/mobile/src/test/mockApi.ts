type Handler = (request: Request) => Response | Promise<Response>;

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const empty = (status: number): Response => new Response(null, { status });

/** Answers the API calls of a test from a table of "METHOD /path" to a handler, anything else fails the test. */
export function mockApi(routes: Record<string, Handler>): jest.Mock {
  const fetchMock = jest.fn(async (input: Request) => {
    const url = new URL(input.url);
    const handler = routes[`${input.method} ${url.pathname}`];
    if (!handler) throw new Error(`Unhandled request: ${input.method} ${url.pathname}`);
    return handler(input);
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}
