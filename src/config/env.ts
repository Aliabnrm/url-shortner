import { isIP } from 'node:net';

type NodeEnvironment = 'development' | 'test' | 'production';

export interface Config {
  readonly nodeEnv: NodeEnvironment;
  readonly host: string;
  readonly port: number;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const host = env.HOST ?? '127.0.0.1';
  const rawPort = env.PORT ?? '3000';

  if (
    nodeEnv !== 'development' &&
    nodeEnv !== 'test' &&
    nodeEnv !== 'production'
  ) {
    throw new Error('NODE_ENV must be development, test, or production.');
  }

  if (isIP(host) === 0) {
    throw new Error('HOST must be a valid IPv4 or IPv6 address.');
  }

  const port = Number(rawPort);

  if (!/^\d+$/.test(rawPort) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return { nodeEnv, host, port };
}
