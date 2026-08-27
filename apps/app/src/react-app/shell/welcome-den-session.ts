export type WelcomeDenAuthStatus =
  | "checking"
  | "signed_in"
  | "unavailable"
  | "signed_out";

export function shouldHoldWelcomeForDenSession({
  authStatus,
  hasStoredAuthToken,
  isSignedIn,
}: {
  authStatus: WelcomeDenAuthStatus;
  hasStoredAuthToken: boolean;
  isSignedIn: boolean;
}) {
  // Account-first onboarding now deliberately renders /welcome after a valid
  // session so the authenticated person can choose Cloud or Local. Hold only
  // while a stored token is still being restored; a confirmed signed-in state
  // is the signal to reveal the runtime-choice surface.
  return !isSignedIn && hasStoredAuthToken && authStatus === "checking";
}
