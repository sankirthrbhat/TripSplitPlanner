import { describe, expect, it } from 'vitest';
import { assertSafeSeedTarget, isLocalMongoUri, parseMongoHosts } from '../src/utils/seedGuard.js';

describe('seed guard (never seed a shared database by accident)', () => {
  it.each([
    ['', true], // embedded local DB
    ['mongodb://localhost:27017/tripsplit', true],
    ['mongodb://127.0.0.1:27017/tripsplit', true],
    ['mongodb://user:p%40ss@localhost/tripsplit?authSource=admin', true],
    ['mongodb://localhost:27017,localhost:27018/tripsplit', true],
    ['mongodb+srv://u:p@cluster0.abcde.mongodb.net/tripsplit', false],
    ['mongodb://u:p@cluster0-shard-00-00.abcde.mongodb.net:27017/tripsplit', false],
    ['mongodb://localhost:27017,evil.example.com:27017/tripsplit', false],
    ['mongodb+srv://localhost/tripsplit', false], // SRV is always treated as remote
    ['not a uri', false],
  ])('uri %j local-or-embedded = %s', (uri, safe) => {
    if (!uri) {
      expect(() => assertSafeSeedTarget(uri)).not.toThrow();
      return;
    }
    expect(isLocalMongoUri(uri)).toBe(safe);
    if (safe) {
      expect(() => assertSafeSeedTarget(uri)).not.toThrow();
    } else {
      expect(() => assertSafeSeedTarget(uri)).toThrow(/Refusing to seed a non-local database/);
    }
  });

  it('explicit opt-in allows a remote seed, and the error never prints credentials', () => {
    const uri = 'mongodb+srv://admin:SuperSecret@cluster0.abcde.mongodb.net/tripsplit';
    expect(() => assertSafeSeedTarget(uri, { allowRemote: true })).not.toThrow();
    try {
      assertSafeSeedTarget(uri);
    } catch (err) {
      expect(err.message).not.toContain('SuperSecret');
      expect(err.message).not.toContain('admin');
      expect(err.message).toContain('cluster0.abcde.mongodb.net');
    }
  });

  it('parses hosts and strips ports/credentials', () => {
    expect(parseMongoHosts('mongodb://u:p@a.example.com:27017,b.example.com:27018/db')).toEqual({
      srv: false,
      hosts: ['a.example.com', 'b.example.com'],
    });
  });
});
