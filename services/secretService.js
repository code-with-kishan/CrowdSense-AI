/**
 * Secret Service
 *
 * Optionally resolves runtime secrets from Google Cloud Secret Manager.
 * Falls back to environment variables when not configured.
 */

let cachedGeminiKey = null;
let cacheLoaded = false;

async function _loadGeminiKeyFromSecretManager() {
  const secretResource = process.env.GEMINI_API_KEY_SECRET;
  if (!secretResource) return null;

  try {
    const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
    const client = new SecretManagerServiceClient();

    const [version] = await client.accessSecretVersion({
      name: secretResource,
    });

    const payload = version?.payload?.data?.toString('utf8')?.trim();
    return payload || null;
  } catch (err) {
    console.log(`[SecretService] Secret Manager unavailable: ${err.message}`);
    return null;
  }
}

async function getGeminiApiKey() {
  if (cacheLoaded) return cachedGeminiKey;

  const secretValue = await _loadGeminiKeyFromSecretManager();
  const envValue = process.env.GEMINI_API_KEY || null;

  cachedGeminiKey = secretValue || envValue;
  cacheLoaded = true;
  return cachedGeminiKey;
}

function clearSecretCache() {
  cachedGeminiKey = null;
  cacheLoaded = false;
}

module.exports = {
  getGeminiApiKey,
  clearSecretCache,
};
