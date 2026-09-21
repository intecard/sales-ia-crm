export type ApiSession = {
  organizationId?: string;
  demo: boolean;
};

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  organizationId?: string,
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(organizationId ? { 'X-Organization-Id': organizationId } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({ success: false, error: 'INVALID_SERVER_RESPONSE' }));
  if (!response.ok) throw new Error(payload.error || `HTTP_${response.status}`);
  return payload as T;
}
