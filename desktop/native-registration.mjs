import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { EXTENSION_ID, NATIVE_HOST } from '../shared/extension-id.mjs';
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
export async function registerNativeHost({ home, executable, clientPath, appPath, directory, platform = process.platform }) {
  if (platform !== 'darwin') throw new Error('This installer supports only macOS');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const launcher = join(directory, 'chrome-native-host');
  const script = `#!/bin/sh\nexport ELECTRON_RUN_AS_NODE=1\nexport SALTICUS_APP_PATH=${quote(appPath)}\nexec ${quote(executable)} ${quote(clientPath)} "$@"\n`;
  await writeFile(launcher, script, { mode: 0o700 });
  const manifest = { name: NATIVE_HOST, description: 'Salticus local app connection', path: launcher, type: 'stdio',
    allowed_origins: [`chrome-extension://${EXTENSION_ID}/`] };
  const nativeDirectory = join(home, 'Library/Application Support/Google/Chrome/NativeMessagingHosts');
  await mkdir(nativeDirectory, { recursive: true });
  const manifestPath = join(nativeDirectory, `${NATIVE_HOST}.json`);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), { mode: 0o600 });
  return manifestPath;
}
