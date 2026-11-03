// The public academy saves to the private server ledger first. The legacy Sheet
// remains a secondary destination; the browser never invents a server receipt.
window.APP_CONFIG = Object.freeze({
  ...window.APP_CONFIG,
  resultsEndpoint: window.ASF_CONFIG.supabaseUrl + '/functions/v1/asf-academy-results',
  resultsPublicKey: window.ASF_CONFIG.supabaseAnonKey,
  submissionMode: 'verified-ledger'
});
