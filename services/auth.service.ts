import { byBackend } from './backend';
import { bongposAuth } from './bongpos/auth';
import { ambelAuth } from './ambel/auth';

/**
 * Signing in. `login(identifier, password)` takes whichever credential the
 * active backend signs in with: an email on BongPOS, a username on Ambel.
 */
export const authService = byBackend<typeof bongposAuth>({ bongpos: bongposAuth, ambel: ambelAuth });
