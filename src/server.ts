import { createApp } from './app.js';
import { readConfig } from './config/env.js';

function startServer() {
  const config = readConfig();
  const app = createApp({ publicBaseUrl: config.publicBaseUrl });
  const server = app.listen(config.port, config.host, () => {
    const host = config.host.includes(':') ? `[${config.host}]` : config.host;
    console.info(
      `Server listening on http://${host}:${config.port} (${config.nodeEnv})`,
    );
  });

  server.once('error', (error) => {
    console.error('Server failed:', error.message);
    process.exitCode = 1;
  });

  let shuttingDown = false;

  function shutdown(signal: NodeJS.Signals) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info(`${signal} received; closing the HTTP server.`);

    // Allow active requests to finish, but never wait indefinitely.
    const deadline = setTimeout(() => {
      console.error('Shutdown timed out after 10 seconds.');
      server.closeAllConnections();
      process.exit(1);
    }, 10_000);
    deadline.unref();

    server.close((error) => {
      clearTimeout(deadline);
      if (error) {
        console.error('Server shutdown failed:', error.message);
        process.exitCode = 1;
        return;
      }
      console.info('HTTP server closed.');
    });
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

try {
  startServer();
} catch (error) {
  console.error(
    'Server failed to start:',
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
}
