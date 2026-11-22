import { BadRequestException } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export interface UrlSecurityDependencies {
  resolveHost?: (hostname: string) => Promise<string[]>;
  findRedirect?: (url: string) => Promise<string | null>;
}

function reject(message: string): never {
  throw new BadRequestException(message);
}

function ipv4ToNumber(address: string): number {
  return address
    .split('.')
    .reduce((value, part) => ((value << 8) | Number(part)) >>> 0, 0);
}

function isBlockedIpv4(address: string): boolean {
  const value = ipv4ToNumber(address);
  const inRange = (base: string, bits: number) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (value & mask) >>> 0 === (ipv4ToNumber(base) & mask) >>> 0;
  };

  return (
    inRange('0.0.0.0', 8) ||
    inRange('10.0.0.0', 8) ||
    inRange('100.64.0.0', 10) ||
    inRange('127.0.0.0', 8) ||
    inRange('169.254.0.0', 16) ||
    inRange('172.16.0.0', 12) ||
    inRange('192.0.0.0', 24) ||
    inRange('192.0.2.0', 24) ||
    inRange('192.168.0.0', 16) ||
    inRange('198.18.0.0', 15) ||
    inRange('198.51.100.0', 24) ||
    inRange('203.0.113.0', 24) ||
    inRange('224.0.0.0', 3) ||
    value === 0xffffffff
  );
}

function expandIpv6(address: string): number[] | null {
  let normalized = address.split('%')[0];

  const embeddedIpv4 = normalized.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (embeddedIpv4 && isIP(embeddedIpv4[1]) === 4) {
    const parts = embeddedIpv4[1].split('.').map(Number);
    const hex = [
      ((parts[0] << 8) | parts[1]).toString(16),
      ((parts[2] << 8) | parts[3]).toString(16),
    ];
    normalized = normalized.slice(0, -embeddedIpv4[1].length) + hex.join(':');
  }

  const halves = normalized.split('::');
  if (halves.length > 2) return null;

  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  if (halves.length === 1 && left.length !== 8) return null;

  const missing = 8 - left.length - right.length;
  if (halves.length === 2 && missing < 1) return null;

  const groups = [
    ...left,
    ...Array.from({ length: Math.max(0, missing) }, () => '0'),
    ...right,
  ];
  if (groups.length !== 8) return null;

  const numbers = groups.map((group) => Number.parseInt(group, 16));
  return numbers.every((value) => Number.isFinite(value) && value >= 0 && value <= 0xffff)
    ? numbers
    : null;
}

function ipv4FromIpv6Groups(groups: number[]): string {
  return `${(groups[0] >> 8) & 0xff}.${groups[0] & 0xff}.${(groups[1] >> 8) & 0xff}.${groups[1] & 0xff}`;
}

export function isBlockedIpAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isBlockedIpv4(address);
  if (version !== 6) return true;

  const groups = expandIpv6(address);
  if (!groups) return true;

  const isAllZero = groups.every((group) => group === 0);
  const isLoopback = isAllZero || groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1;
  const isUniqueLocal = (groups[0] & 0xfe00) === 0xfc00;
  const isLinkLocal = (groups[0] & 0xffc0) === 0xfe80;
  const isDocumentation = groups[0] === 0x2001 && groups[1] === 0x0db8;
  const isTeredo = groups[0] === 0x2001 && groups[1] === 0x0000;
  const is6to4 = groups[0] === 0x2002;
  const isNat64 = groups[0] === 0x0064 && groups[1] === 0xff9b;

  const isIpv4Mapped =
    groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
  if (isIpv4Mapped) {
    return isBlockedIpv4(ipv4FromIpv6Groups(groups.slice(6)));
  }
  if (is6to4) {
    return isBlockedIpv4(ipv4FromIpv6Groups(groups.slice(1, 3)));
  }

  return (
    isLoopback ||
    isUniqueLocal ||
    isLinkLocal ||
    isDocumentation ||
    isTeredo ||
    isNat64 ||
    is6to4
  );
}

async function defaultResolveHost(hostname: string): Promise<string[]> {
  const results = await lookup(hostname, { all: true, verbatim: true });
  return results.map((result) => result.address);
}

async function readRedirectTarget(url: string): Promise<string | null> {
  const headers = {
    'User-Agent': 'DigitalArchaeologist/0.1 (+local research tool)',
    Range: 'bytes=0-0',
  };

  for (const method of ['HEAD', 'GET'] as const) {
    try {
      const response = await fetch(url, {
        method,
        headers,
        redirect: 'manual',
        signal: AbortSignal.timeout(8000),
      });
      const location = response.headers.get('location');
      await response.body?.cancel();

      if (REDIRECT_STATUSES.has(response.status)) {
        return location ? new URL(location, url).toString() : reject('Redirect has no target');
      }
      if (response.status !== 405 || method === 'GET') return null;
    } catch (error) {
      if (method === 'GET') return null;
      if (error instanceof BadRequestException) throw error;
    }
  }
  return null;
}

async function assertSafeUrl(
  rawUrl: string,
  dependencies: UrlSecurityDependencies,
): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    reject('Enter a valid HTTPS repository URL');
  }

  if (parsed.protocol !== 'https:') {
    reject('Only HTTPS repository URLs are supported');
  }
  if (parsed.username || parsed.password) {
    reject('Repository URLs must not contain credentials');
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '');
  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    reject('That repository host is not permitted');
  }

  const resolveHost = dependencies.resolveHost ?? defaultResolveHost;
  let addresses: string[];
  try {
    addresses = isIP(hostname)
      ? [hostname]
      : await resolveHost(hostname);
  } catch {
    reject('Unable to resolve the repository host');
  }

  if (addresses.length === 0) {
    reject('Unable to resolve the repository host');
  }
  if (addresses.some((address) => isBlockedIpAddress(address))) {
    reject('Repository host resolves to a private or reserved address');
  }

  return parsed.toString();
}

export async function resolveSafeRemoteUrl(
  rawUrl: string,
  dependencies: UrlSecurityDependencies = {},
): Promise<string> {
  let current = await assertSafeUrl(rawUrl, dependencies);
  const findRedirect = dependencies.findRedirect ?? readRedirectTarget;

  for (let hop = 0; hop < MAX_REDIRECTS; hop += 1) {
    const next = await findRedirect(current);
    if (!next) return current;
    current = await assertSafeUrl(next, dependencies);
  }

  reject('Too many redirects while validating the repository URL');
}
