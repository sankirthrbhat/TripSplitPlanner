/**
 * Safety guards for the demo seed script.
 * The seed creates accounts with a publicly documented password, so it must never
 * run against a shared/remote database by accident.
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

/**
 * Extracts the host list from a MongoDB connection string without parsing credentials.
 * Returns { srv: boolean, hosts: string[] }.
 */
export function parseMongoHosts(uri) {
  const match = /^mongodb(\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/i.exec(String(uri || '').trim());
  if (!match) return { srv: false, hosts: [] };
  const hosts = match[2]
    .split(',')
    .map((h) => h.trim().replace(/:\d+$/, '').toLowerCase())
    .filter(Boolean);
  return { srv: Boolean(match[1]), hosts };
}

export function isLocalMongoUri(uri) {
  const { srv, hosts } = parseMongoHosts(uri);
  if (srv || hosts.length === 0) return false;
  return hosts.every((h) => LOCAL_HOSTS.has(h));
}

/**
 * Throws when the seed would write into a non-local database without explicit opt-in.
 * An empty URI means the embedded local database, which is always allowed.
 */
export function assertSafeSeedTarget(uri, { allowRemote = false } = {}) {
  if (!uri) return;
  if (isLocalMongoUri(uri)) return;
  if (allowRemote) return;
  const { hosts } = parseMongoHosts(uri);
  throw new Error(
    `Refusing to seed a non-local database (${hosts.join(', ') || 'unparseable URI'}). ` +
      'The demo seed creates accounts with a public password. ' +
      'Set ALLOW_REMOTE_SEED=true only if you really intend to do this.'
  );
}
