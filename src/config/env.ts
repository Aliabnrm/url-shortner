import { isIP } from 'node:net';

type NodeEnvironment = 'development' | 'test' | 'production';

export interface Config {
  readonly nodeEnv: NodeEnvironment;
  readonly host: string;
  readonly port: number;
  readonly publicBaseUrl: string;
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

  const publicHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
  const urlHost = publicHost.includes(':') ? `[${publicHost}]` : publicHost;
  const rawBaseUrl = env.PUBLIC_BASE_URL ?? `http://${urlHost}:${port}`;
  let publicUrl: URL;
  try {
    publicUrl = new URL(rawBaseUrl);
  } catch {
    throw new Error('PUBLIC_BASE_URL must be an absolute HTTP(S) origin.');
  }

  if (
    !/^https?:\/\//i.test(rawBaseUrl) ||
    (publicUrl.protocol !== 'http:' && publicUrl.protocol !== 'https:') ||
    publicUrl.username ||
    publicUrl.password ||
    publicUrl.pathname !== '/' ||
    publicUrl.search ||
    publicUrl.hash ||
    /[\u0000-\u0020\u007f]/.test(rawBaseUrl)
  ) {
    throw new Error(
      'PUBLIC_BASE_URL must be an HTTP(S) origin without credentials, path, query, or fragment.',
    );
  }

  return { nodeEnv, host, port, publicBaseUrl: publicUrl.origin };
}
