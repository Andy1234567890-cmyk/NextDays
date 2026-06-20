/**
 * finAPI Configuration Utility
 * Manages different finAPI environments (sandbox vs production)
 */

export const FINAPI_CONFIG = {
  sandbox: {
    baseUrl: 'https://sandbox.finapi.io',
    environment: 'sandbox',
  },
  production: {
    baseUrl: 'https://finapi.io',
    environment: 'production',
  },
} as const;

/**
 * Get finAPI credential type based on environment
 */
export function getFinAPICredentialType(): 'sandbox' | 'production' {
  // Check for environment variable first
  const finapiEnv = process.env.FINAPI_ENVIRONMENT || process.env.NEXT_PUBLIC_FINAPI_ENVIRONMENT;

  if (finapiEnv === 'production') {
    return 'production';
  }

  // Default to sandbox for development and when env is not explicitly set to production
  return 'sandbox';
}

/**
 * Get finAPI base URL based on credential type
 */
export function getFinApiBaseUrl(credentialType: 'sandbox' | 'admin' = 'sandbox'): string {
  return credentialType === 'admin'
    ? FINAPI_CONFIG.production.baseUrl
    : FINAPI_CONFIG.sandbox.baseUrl;
}

/**
 * Get finAPI credentials based on type
 */
export function getFinApiCredentials(credentialType: 'sandbox' | 'admin' = 'sandbox') {
  return credentialType === 'admin'
    ? {
        clientId: process.env.FINAPI_ADMIN_CLIENT_ID,
        clientSecret: process.env.FINAPI_ADMIN_CLIENT_SECRET,
      }
    : {
        clientId: process.env.FINAPI_SANDBOX_CLIENT_ID,
        clientSecret: process.env.FINAPI_SANDBOX_CLIENT_SECRET,
      };
}

/**
 * Build finAPI authorization header
 */
export function buildFinApiAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
}

/**
 * Check if finAPI is in production mode
 */
export function isFinAPIProduction(): boolean {
  return getFinAPICredentialType() === 'production';
}

/**
 * Check if finAPI is in sandbox mode
 */
export function isFinAPISandbox(): boolean {
  return getFinAPICredentialType() === 'sandbox';
}

/**
 * Get pagination configuration for finAPI requests
 */
export function getFinAPIPagination() {
  return {
    defaultPage: 1,
    defaultPerPage: 100,
    maxPerPage: 500,
  };
}
