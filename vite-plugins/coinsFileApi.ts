import fs from 'node:fs/promises';
import path from 'node:path';
import type { Plugin } from 'vite';

/**
 * Dev-only API so the app can save edits straight into data/coins.json.
 *   GET  /api/coins  -> the file's contents
 *   PUT  /api/coins  -> replaces the file (the previous version is kept as coins.backup.json)
 * Not part of production builds; there the app falls back to browser storage.
 */
export function coinsFileApi(file = 'data/coins.json'): Plugin {
  return {
    name: 'mycoins-file-api',
    apply: 'serve',
    configureServer(server) {
      const abs = path.resolve(server.config.root, file);
      const backup = abs.replace(/\.json$/, '.backup.json');

      server.middlewares.use('/api/coins', async (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };
        try {
          if (req.method === 'GET') {
            send(200, JSON.parse(await fs.readFile(abs, 'utf8')));
            return;
          }
          if (req.method === 'PUT') {
            let raw = '';
            for await (const chunk of req) raw += chunk;
            const data = JSON.parse(raw);
            if (!data || !Array.isArray(data.coins)) {
              send(400, { error: 'Expected { "coins": [...] }' });
              return;
            }
            await fs.copyFile(abs, backup).catch(() => undefined);
            const tmp = `${abs}.tmp`;
            await fs.writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
            await fs.rename(tmp, abs);
            send(200, { ok: true });
            return;
          }
          send(405, { error: 'Method not allowed' });
        } catch (err) {
          send(500, { error: err instanceof Error ? err.message : String(err) });
        }
      });
    },
  };
}
