import { argon2Verify } from 'hash-wasm';
import { getPasswordHash } from '../secrets/ssm.js';

/**
 * Standard PHC encoded format: $argon2id$v=19$m=<KiB>,t=<iters>,p=<lanes>$<salt>$<hash>.
 * hash-wasm's argon2Verify accepts this same string the argon2-cli and node-argon2
 * paths in infra/runbooks/bootstrap.md produce.
 *
 * The dummy hash below is a constant. A verify against it takes the same wall-clock
 * budget as a real verify, eliminating the timing oracle described in AC-4. It was
 * generated offline against a random throwaway password; matching the dummy is
 * harmless — only the real SSM-stored hash gates access.
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$bfd2sHLImRirDGqqLI7x7Q$geamXYm16YVEEh+LqI49CZ3f+/WkW8V7WMp87Ef18jE';

export async function verifyPassword(input: string): Promise<boolean> {
  let stored: string;
  try {
    stored = await getPasswordHash();
  } catch {
    // Run a verify against the dummy so the failure path has the same
    // timing profile as the success path. We still return false.
    await argon2Verify({ password: input, hash: DUMMY_HASH }).catch(() => false);
    return false;
  }
  try {
    return await argon2Verify({ password: input, hash: stored });
  } catch {
    // Malformed stored hash — same uniform-timing rule.
    await argon2Verify({ password: input, hash: DUMMY_HASH }).catch(() => false);
    return false;
  }
}
