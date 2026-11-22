import { isBlockedIpAddress, resolveSafeRemoteUrl } from '../../src/modules/repositories/git-url.util';

const safeDependencies = {
  resolveHost: jest.fn<Promise<string[]>, [string]>(async () => ['93.184.216.34']),
  findRedirect: jest.fn<Promise<string | null>, [string]>(async () => null),
};

describe('resolveSafeRemoteUrl', () => {
  beforeEach(() => {
    safeDependencies.resolveHost.mockClear();
    safeDependencies.findRedirect.mockClear();
  });

  it('accepts a public HTTPS URL', async () => {
    const result = await resolveSafeRemoteUrl(
      'https://github.com/example/repository.git',
      safeDependencies,
    );
    expect(result).toBe('https://github.com/example/repository.git');
  });

  it.each([
    'http://github.com/example/repository.git',
    'ssh://git@github.com/example/repository.git',
    'file:///C:/source',
    'git://github.com/example/repository.git',
  ])('rejects non-HTTPS URL %s', async (url) => {
    await expect(resolveSafeRemoteUrl(url, safeDependencies)).rejects.toThrow(
      'Only HTTPS repository URLs are supported',
    );
  });

  it('rejects embedded credentials', async () => {
    await expect(
      resolveSafeRemoteUrl('https://user:password@github.com/example/repository.git', safeDependencies),
    ).rejects.toThrow('must not contain credentials');
  });

  it('rejects local hostnames', async () => {
    await expect(
      resolveSafeRemoteUrl('https://localhost/example/repository.git', safeDependencies),
    ).rejects.toThrow('host is not permitted');
  });

  it('rejects when DNS resolves to a private address', async () => {
    safeDependencies.resolveHost.mockResolvedValueOnce(['10.0.0.5']);
    await expect(
      resolveSafeRemoteUrl('https://git.example.com/repository.git', safeDependencies),
    ).rejects.toThrow('private or reserved address');
  });

  it('validates every redirect hop', async () => {
    safeDependencies.findRedirect
      .mockResolvedValueOnce('https://git.example.org/repository.git')
      .mockResolvedValueOnce('https://127.0.0.1/repository.git');

    await expect(
      resolveSafeRemoteUrl('https://github.com/example/repository.git', safeDependencies),
    ).rejects.toThrow('private or reserved address');
    expect(safeDependencies.resolveHost).toHaveBeenCalledTimes(2);
  });

  it('stops after too many redirects', async () => {
    safeDependencies.findRedirect.mockResolvedValue('https://github.com/next/repository.git');
    await expect(
      resolveSafeRemoteUrl('https://github.com/example/repository.git', safeDependencies),
    ).rejects.toThrow('Too many redirects');
  });
});

describe('isBlockedIpAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '::1',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '2001:db8::1',
  ])('blocks %s', (address) => {
    expect(isBlockedIpAddress(address)).toBe(true);
  });

  it.each(['93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946'])(
    'allows public address %s',
    (address) => {
      expect(isBlockedIpAddress(address)).toBe(false);
    },
  );
});
