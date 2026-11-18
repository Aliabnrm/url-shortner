export interface Link {
  readonly shortCode: string;
  readonly originalUrl: string;
}

export class MemoryLinkStore {
  private readonly links = new Map<string, Link>();

  insertIfAbsent(link: Link): boolean {
    if (this.links.has(link.shortCode)) return false;

    // This synchronous operation cannot be interleaved in one Node.js process.
    this.links.set(link.shortCode, link);
    return true;
  }

  find(shortCode: string): Link | undefined {
    return this.links.get(shortCode);
  }
}
