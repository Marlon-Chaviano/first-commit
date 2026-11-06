/** Better Auth's error codes after an OAuth round trip, in words. */
const OAUTH_ERRORS: Record<string, string> = {
  access_denied: "The login was cancelled. Try again when you're ready.",
  account_not_linked: "That email already has an account with another method: log in the way you did the first time, then link this one from Settings.",
  unable_to_link_account: "That email already has an account with another method: log in the way you did the first time, then link this one from Settings.",
  email_not_found: "Your account doesn't share an email address. Make one visible (or verified) and try again.",
  state_mismatch: "The login took too long or was opened in another tab. Try again.",
};
export const oauthErrorMessage = (code: string) => OAUTH_ERRORS[code] ?? "Couldn't log in. Try again in a moment.";
