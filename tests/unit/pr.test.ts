import { describe, it, expect } from 'vitest';
import { parsePrArg } from '../../src/pr.js';

describe('parsePrArg', () => {
  it('parses the owner/repo#number short form', () => {
    const ref = parsePrArg('octocat/hello-world#42');
    expect(ref).toMatchObject({
      owner: 'octocat',
      repo: 'hello-world',
      number: 42,
      slug: 'octocat/hello-world#42',
    });
    expect(ref.key).toMatch(/^[0-9a-f]{16}$/);
  });

  it('parses a full GitHub PR URL', () => {
    const ref = parsePrArg('https://github.com/octocat/Hello-World/pull/10396');
    expect(ref).toMatchObject({ owner: 'octocat', repo: 'Hello-World', number: 10396 });
    expect(ref.slug).toBe('octocat/Hello-World#10396');
  });

  it('strips a trailing .git from the repo in a URL', () => {
    const ref = parsePrArg('https://github.com/cli/cli.git/pull/1');
    expect(ref.repo).toBe('cli');
  });

  it('trims surrounding whitespace', () => {
    expect(parsePrArg('  octocat/hello-world#1  ').number).toBe(1);
  });

  it('produces a stable key for the same slug and distinct keys for different slugs', () => {
    expect(parsePrArg('a/b#1').key).toBe(parsePrArg('a/b#1').key);
    expect(parsePrArg('a/b#1').key).not.toBe(parsePrArg('a/b#2').key);
  });

  it('throws a helpful error on an unparseable argument', () => {
    expect(() => parsePrArg('not-a-pr')).toThrow(/Could not parse PR reference/);
  });
});
