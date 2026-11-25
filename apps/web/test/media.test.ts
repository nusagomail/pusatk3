import { describe, expect, it } from 'vitest';
import { mediaOrigin, safeMediaBaseUrl } from '../src/lib/media';

describe('safeMediaBaseUrl', () => {
  it.each([
    ['https://media.pusatk3.id', 'https://media.pusatk3.id'],
    ['https://media.pusatk3.id/', 'https://media.pusatk3.id'],
    ['https://cdn.example.com/pusatk3/video/', 'https://cdn.example.com/pusatk3/video'],
  ])('accepts %j', (input, expected) => {
    expect(safeMediaBaseUrl(input)).toBe(expected);
  });

  it.each([
    undefined,
    '',
    'http://media.pusatk3.id',
    'javascript:alert(1)//',
    'https://user:pass@media.pusatk3.id',
    'https://media.pusatk3.id/?x=',
    'https://media.pusatk3.id/#a',
    'not a url',
  ])('rejects %j', (input) => {
    expect(safeMediaBaseUrl(input)).toBeNull();
  });
});

describe('mediaOrigin', () => {
  it('returns only the origin for the CSP, or null', () => {
    expect(mediaOrigin('https://cdn.example.com/pusatk3/video/')).toBe('https://cdn.example.com');
    expect(mediaOrigin('')).toBeNull();
  });
});
