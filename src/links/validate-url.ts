import { AppError } from '../errors/app-error.js';

const MAX_URL_LENGTH = 2048;

export function validateCreateLinkInput(input: unknown): string {
  if (
    typeof input !== 'object' ||
    input === null ||
    Array.isArray(input) ||
    !('url' in input) ||
    typeof input.url !== 'string'
  ) {
    throw new AppError(400, 'INVALID_INPUT', 'url must be a string.');
  }

  const value = input.url.trim();
  if (value.length === 0 || value.length > MAX_URL_LENGTH) {
    throw new AppError(
      400,
      'INVALID_INPUT',
      `url must contain between 1 and ${MAX_URL_LENGTH} characters.`,
    );
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppError(
      400,
      'INVALID_INPUT',
      'url must be a valid absolute URL.',
    );
  }

  if (
    !/^https?:\/\//i.test(value) ||
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new AppError(
      400,
      'INVALID_INPUT',
      'url must use http:// or https:// and contain no control characters.',
    );
  }

  if (url.username || url.password) {
    throw new AppError(
      400,
      'INVALID_INPUT',
      'url must not contain credentials.',
    );
  }

  if (url.href.length > MAX_URL_LENGTH) {
    throw new AppError(
      400,
      'INVALID_INPUT',
      `The normalized URL must not exceed ${MAX_URL_LENGTH} characters.`,
    );
  }

  return url.href;
}
