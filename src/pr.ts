import crypto from 'node:crypto';

export interface PrRef {
  owner: string;
  repo: string;
  number: number;
  /** Canonical `owner/repo#number`. */
  slug: string;
  /** Stable session key (used as the per-PR state filename). */
  key: string;
}

/**
 * Parse a PR reference from either `owner/repo#123` or a GitHub PR URL.
 */
export function parsePrArg(arg: string): PrRef {
  const trimmed = arg.trim();
  const url = trimmed.match(/github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/i);
  const short = trimmed.match(/^([^/\s]+)\/([^/#\s]+)#(\d+)$/);

  let owner: string;
  let repo: string;
  let number: number;

  if (url) {
    owner = url[1];
    repo = url[2].replace(/\.git$/, '');
    number = Number(url[3]);
  } else if (short) {
    owner = short[1];
    repo = short[2];
    number = Number(short[3]);
  } else {
    throw new Error(
      `Could not parse PR reference "${arg}". Use "owner/repo#123" or a GitHub PR URL.`,
    );
  }

  const slug = `${owner}/${repo}#${number}`;
  const key = crypto.createHash('sha256').update(slug).digest('hex').slice(0, 16);
  return { owner, repo, number, slug, key };
}
