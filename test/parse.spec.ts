import { parse } from '../src/parse';

describe('parse', () => {
  it('can parse an integer', () => {
    let result = parse('42');
    expect(result).toBeDefined();
    expect(result()).toBe(42);
  });

  it('can parse a floating point number', () => {
    const result = parse('4.2');
    expect(result()).toBe(4.2);
  });

  it('can parse a floating point number without an integer part', () => {
    const result = parse('.42');

    expect(result()).toBe(.42);
  });

  it('can parse a number in scientific notation', () => {
    const result = parse('42e3');
    expect(result()).toBe(42000);
  });

  it('can parse scientific notation with a float coefficient', () => {
    const result = parse('.42e2');
    expect(result()).toBe(42);
  });

  it('can parse scientific notation with negative exponents', () => {
    const result = parse('4200e-2');
    expect(result()).toBe(42);
  });

  it('can parse scientific notation with + sign before exponent', () => {
    const result = parse('.42e+2');
    expect(result()).toBe(42);
  });

  it('can parse upper case scientific notation', () => {
    const result = parse('.42E2');
    expect(result()).toBe(42);
  });

  it('will not parse invalid scientific notation', () => {
    expect(() => parse('42e-')).toThrow();
    expect(() => parse('42e-a')).toThrow();
  });

  it('can parse a string in single quotes', () => {
    const result = parse("'abc'");
    expect(result()).toBe('abc');
  });

  it('can parse a string in double quotos', () => {
    const result = parse('"abc"');
    expect(result()).toBe('abc');
  });

  it('will not parse a string with mismatching quotes', () => {
    expect(() => parse(`"abc'`)).toThrow();
  });

  it('can parse a string with single quotes inside', () => {
    const result = parse("'a\\\'b'");
    expect(result()).toBe('a\'b');
  });

  it('can parse a string with double quotes inside', () => {
    const result = parse('"a\\\"b"');
    expect(result()).toBe('a\"b');
  });

  it('will parse a string with unicode escapes', () => {
    const result = parse('"\\u00A0"');
    expect(result()).toBe('\u00A0');
  });

  it('will not parse a string with invalid unicode escapes', () => {
    expect(() => parse('"\\u00T0"')).toThrow();
  });

  it('will parse null', () => {
    const result = parse('null');
    expect(result()).toBe(null);
  });

  it('will parse true', () => {
    const result = parse('true');
    expect(result()).toBe(true);
  });

  it('will parse false', () => {
    const result = parse('false');
    expect(result()).toBe(false);
  });

  it('ignores whitespace', () => {
    const result = parse(' \n42 ');
    expect(result()).toBe(42);
  });

  it('will parse an empty array', () => {
    const result = parse('[]');
    expect(result()).toEqual([]);
  });
});
