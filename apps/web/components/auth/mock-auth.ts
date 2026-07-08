/* Sprint 4.1 is UI-only. These mocks stand in for the real authentication
   API and define the async contract the forms depend on. In a later sprint
   the bodies get swapped for real network calls — the form components never
   change, since they only depend on these Promise-returning functions. */

export interface Credentials {
  email: string;
  password: string;
}

export interface SignUpDetails extends Credentials {
  fullName: string;
}

const NETWORK_DELAY_MS = 1200;

const wait = () =>
  new Promise<void>((resolve) => setTimeout(resolve, NETWORK_DELAY_MS));

export async function signIn(credentials: Credentials): Promise<void> {
  await wait();
  if (!credentials.email) {
    throw new Error("Unable to sign in. Please try again.");
  }
}

export async function signUp(details: SignUpDetails): Promise<void> {
  await wait();
  if (!details.email) {
    throw new Error("Unable to create your account. Please try again.");
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  await wait();
  if (!email) {
    throw new Error("Unable to send a reset link. Please try again.");
  }
}
