import { Backend, getBackend } from '../lib/serverConfig';

/**
 * One service, two implementations. Every call goes to the backend the app is
 * pointed at right now (lib/serverConfig), so switching on the login screen
 * needs no reload and the screens keep importing a single service.
 */
export function byBackend<T extends object>(impls: Record<Backend, T>): T {
  return new Proxy({} as T, {
    get: (_, key) => (impls[getBackend()] as any)[key],
  });
}
