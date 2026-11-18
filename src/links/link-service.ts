import { randomBytes } from 'node:crypto';
import { AppError } from '../errors/app-error.js';
import { MemoryLinkStore, type Link } from './link-store.js';
import { validateCreateLinkInput } from './validate-url.js';

export const SHORT_CODE_PATTERN = /^[A-Za-z0-9_-]{8}$/;
const MAX_CODE_ATTEMPTS = 10;

export function generateShortCode(): string {
  return randomBytes(6).toString('base64url');
}

export class LinkService {
  constructor(
    private readonly store: MemoryLinkStore,
    private readonly generateCode: () => string = generateShortCode,
  ) {}

  create(input: unknown): Link {
    const originalUrl = validateCreateLinkInput(input);

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const shortCode = this.generateCode();
      if (!SHORT_CODE_PATTERN.test(shortCode)) {
        throw new Error('The code generator returned an invalid short code.');
      }

      const link: Link = { shortCode, originalUrl };
      if (this.store.insertIfAbsent(link)) return link;
    }

    throw new AppError(
      503,
      'CODE_GENERATION_FAILED',
      'Could not allocate a short code. Please try again.',
    );
  }

  find(shortCode: string): Link {
    const link = this.store.find(shortCode);
    if (!link) {
      throw new AppError(404, 'LINK_NOT_FOUND', 'Short link not found.');
    }
    return link;
  }
}
