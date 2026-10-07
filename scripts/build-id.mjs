import { execSync } from 'node:child_process';

export function buildId() {
  const fromCi = process.env.GITHUB_SHA?.trim() ?? '';
  const sha = /^[0-9a-f]{7,40}$/i.test(fromCi)
    ? fromCi
    : execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  if (!/^[0-9a-f]{7,40}$/i.test(sha)) throw new Error('Could not resolve a git SHA for the build id');
  return sha.slice(0, 7).toLowerCase();
}
