import { parseArgs } from 'node:util';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Companion } from './server.mjs';

const { values } = parseArgs({ options: {
  'data-dir': { type: 'string' }, name: { type: 'string' },
  'api-port': { type: 'string', default: '37842' }, 'peer-port': { type: 'string', default: '37843' },
  advertise: { type: 'string', multiple: true, default: [] },
  'no-discovery': { type: 'boolean' }, help: { type: 'boolean' },
} });
if (values.help) {
  console.log('Salticus local companion\n\nnpm start -- --name My-device\n\n--advertise <public or virtual LAN address>  May be repeated\n--peer-port <port>  Peer connection port (default 37843)\n--api-port <port>   Local extension port (default 37842)\n--data-dir <directory>   Store device identity and pairings\n--no-discovery     Disable LAN discovery');
} else {
  for (const key of ['api-port', 'peer-port']) {
    if (!/^\d+$/.test(values[key]) || +values[key] < 1 || +values[key] > 65535) throw new Error(`Invalid ${key}`);
  }
  const companion = new Companion({ directory: values['data-dir'] ?? join(homedir(), '.salticus'), name: values.name,
    apiPort: +values['api-port'], peerPort: +values['peer-port'], advertise: values.advertise, discovery: !values['no-discovery'] });
  try {
    await companion.start();
    console.log(`Salticus local companion started\n\nExtension address: ws://127.0.0.1:${companion.apiPort}/extension\nLocal connection key: ${companion.config.token}\nDevice identity: ${companion.identity.id}\nPeer port: ${companion.peerPort}\n\nIn the Chrome extension, enter the address and local key. This key is only for the local extension connection; never include it in a room invitation.\nPress Ctrl+C to quit.`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await companion.stop(); process.exit(0); });
  } catch (error) {
    console.error(`Could not start Salticus: ${error.message}`); process.exitCode = 1;
  }
}
