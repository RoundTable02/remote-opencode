/**
 * Utility for opencode server Basic Auth.
 * opencode serve (v1.2+) may require HTTP Basic Auth if
 * OPENCODE_SERVER_USERNAME / OPENCODE_SERVER_PASSWORD are set.
 */

export function getAuthHeaders(): Record<string, string> {
  const username = process.env.OPENCODE_SERVER_USERNAME;
  const password = process.env.OPENCODE_SERVER_PASSWORD;

  if (username && password) {
    const encoded = Buffer.from(`${username}:${password}`).toString('base64');
    return { 'Authorization': `Basic ${encoded}` };
  }

  return {};
}

export function getAuthHeadersWithJson(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
  };
}

/**
 * Build an EventSource-compatible URL with auth embedded.
 * EventSource doesn't support custom headers, so we embed credentials in the URL.
 */
export function getAuthenticatedUrl(baseUrl: string): string {
  const username = process.env.OPENCODE_SERVER_USERNAME;
  const password = process.env.OPENCODE_SERVER_PASSWORD;

  if (username && password) {
    // http://127.0.0.1:port -> http://user:pass@127.0.0.1:port
    const url = new URL(baseUrl);
    url.username = username;
    url.password = password;
    return url.toString();
  }

  return baseUrl;
}
