import { generate } from 'selfsigned';
import { mkdir, readFile, chmod, rename, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes, X509Certificate } from 'node:crypto';

export const fingerprint = cert => new X509Certificate(cert).fingerprint256.replaceAll(':', '').toLowerCase();

export async function loadIdentity(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const keyPath = join(directory, 'peer-key.pem');
  const certPath = join(directory, 'peer-cert.pem');
  let keyExists = false, certExists = false;
  try { await access(keyPath); keyExists = true; } catch {}
  try { await access(certPath); certExists = true; } catch {}
  if (keyExists !== certExists) throw new Error('Device certificate is incomplete. Restore a backup or use a new data directory');
  if (!keyExists) {
    const suffix = randomBytes(8).toString('hex');
    const temporaryKey = `${keyPath}.${suffix}`, temporaryCert = `${certPath}.${suffix}`;
    const generated = await generate([{ name: 'commonName', value: 'Salticus' }], {
      keySize: 2048, algorithm: 'sha256', notAfterDate: new Date(Date.now() + 3650 * 86400000),
    });
    await writeFile(temporaryKey, generated.private, { mode: 0o600 });
    await writeFile(temporaryCert, generated.cert, { mode: 0o600 });
    await chmod(temporaryKey, 0o600);
    await rename(temporaryKey, keyPath);
    await rename(temporaryCert, certPath);
  }
  await chmod(keyPath, 0o600);
  const [key, cert] = await Promise.all([readFile(keyPath), readFile(certPath)]);
  return { key, cert, id: fingerprint(cert) };
}

export async function loadConfig(directory, name) {
  const path = join(directory, 'config.json');
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw new Error('Cannot read the configuration. Check its contents');
    const config = { version: 1, name: name || 'My device', token: randomBytes(32).toString('hex'), rooms: {}, contacts: {} };
    await saveConfig(directory, config);
    return config;
  }
}

export async function saveConfig(directory, config) {
  const path = join(directory, 'config.json');
  // All writes go through one queue in Companion; replace atomically.
  await writeFile(`${path}.tmp`, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await rename(`${path}.tmp`, path);
}
