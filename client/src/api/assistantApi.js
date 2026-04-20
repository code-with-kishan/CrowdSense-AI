const API_BASE = '/api/v1';

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function sendAssistantMessage({ message, sessionId, location = 'concourse_n' }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${API_BASE}/assistant/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, sessionId, location }),
      signal: controller.signal,
    });

    const raw = await response.text();
    const payload = parseJsonSafe(raw);

    if (!response.ok) {
      const apiError = payload?.error || `Request failed (${response.status})`;
      throw new Error(apiError);
    }

    if (!payload?.success || !payload?.data?.response) {
      throw new Error('Unexpected assistant response format');
    }

    return payload.data;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Assistant request timed out. Please try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
