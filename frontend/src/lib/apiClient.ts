/**
 * API Client for authenticated requests to the backend.
 * In development (NEXT_PUBLIC_API_URL is set), uses 'dev-token' for the dev bypass.
 * In production, requires a valid Clerk token.
 */

export async function apiCall(
  endpoint: string,
  options: RequestInit & { getToken?: () => Promise<string | null> } = {}
): Promise<Response> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
  const url = `${apiUrl}${endpoint}`;

  // Get the token
  let token: string | null = null;

  // In development (NEXT_PUBLIC_API_URL is set), use the dev-token bypass
  if (process.env.NEXT_PUBLIC_API_URL) {
    token = "dev-token";
  } else {
    // In production, get the real Clerk token
    if (options.getToken) {
      token = await options.getToken();
    }
  }

  // Prepare headers
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Add authorization header if token is available
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Remove getToken from options before passing to fetch
  const { getToken, ...fetchOptions } = options;

  return fetch(url, {
    ...fetchOptions,
    headers,
  });
}
