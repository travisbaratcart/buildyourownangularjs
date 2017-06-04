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

    expect(result()).toBe(0.42);
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

  it('will parse a non-empty array', () => {
    const result = parse('[1, "two", [3], true]');
    expect(result()).toEqual([1, 'two', [3], true]);
  });

  it('will parse an array with trailing commas', () => {
    const result = parse('[1, 2, 3, ]');
    expect(result()).toEqual([1, 2, 3]);
  });

  it('will parse an empty object', () => {
    const result = parse('{}');
    expect(result()).toEqual({});
  });

  it('will parse a nonempty object', () => {
    const result = parse('{ "a key": 1, \'another-key\': 2 }');
    expect(result()).toEqual({ 'a key': 1, 'another-key': 2 });
  });

  it('will parse an object with an identifier keys', () => {
    const result = parse('{ a: 1, b: [2, 3], c: { d: 4} }');
    expect(result()).toEqual({ a: 1, b: [2, 3], c: { d: 4} });
  });

  it('looks up an attribute from the scope', () => {
    const result = parse('aKey');

    expect(result({ aKey: 42 })).toBe(42);
    expect(result({})).toBeUndefined();
  });

  it('returns undefined when looking up attributes from undefined', () => {
    const result = parse('aKey');
    expect(result()).toBeUndefined();
  });

  it('will parse this', () => {
    const result = parse('this');
    const scope = {};

    expect(result(scope)).toBe(scope);
    expect(result()).toBeUndefined();
  });

  it('looks up a 2-part identifier path from the scope', () => {
    const result = parse('aKey.anotherKey');

    expect(result({ aKey: { anotherKey: 42 } })).toBe(42);
    expect(result({ aKey: {} })).toBeUndefined();
    expect(result({})).toBeUndefined();
    expect(result()).toBeUndefined();
  });

  it('looks up a member from an object', () => {
    const result = parse('{ aKey: 42 }.aKey');
    expect(result()).toBe(42);
  });

  it('looks up a 4-part identifier path from the scope', () => {
    const result = parse('aKey.secondKey.thirdKey.fourthKey');

    expect(result({ aKey: { secondKey: { thirdKey: { fourthKey: 42 } } } })).toBe(42);
    expect(result({ aKey: { secondKey: { thirdKey: {} } } })).toBeUndefined()
    expect(result({ aKey: { secondKey: {} } })).toBeUndefined()
    expect(result({ aKey: {} })).toBeUndefined()
    expect(result({})).toBeUndefined()
    expect(result()).toBeUndefined()
  });

  it('uses locals instead of scope when there is a matching key', () => {
    const result = parse('aKey');
    const scope = { aKey: 42 };
    const locals = { aKey: 43 };
    expect(result(scope, locals)).toBe(43);
  });

  it('does not use locals instead of scope when there is no matching key', () => {
    const result = parse('aKey');
    const scope = { aKey: 42 };
    const locals = { otherKey: 43 };
    expect(result(scope, locals)).toBe(42);
  });

  it('uses locals instead of scope when the first part matches', () => {
    const result = parse('aKey.anotherKey');
    const scope = { aKey: { anotherKey: 42} };
    const locals = { aKey: {} };
    expect(result(scope, locals)).toBeUndefined();
  });

  it('parses a simple computed property access', () => {
    const result = parse('aKey["anotherKey"]');
    expect(result({ aKey: { anotherKey: 42 } })).toBe(42);
  });

  it('parses a computed numeric array access', () => {
    const result = parse('anArray[1]');
    expect(result({ anArray: [1, 2, 3] })).toBe(2);
  });

  it('parses a computed access with another key as the property', () => {
    const result = parse('lock[key]');
    expect(result({ key: 'theKey', lock: { theKey: 42 } })).toBe(42);
  });

  it('parses computed access with another access as the property', () => {
    const result = parse('lock[keys["aKey"]]');
    expect(result({ keys: { aKey: 'theKey' }, lock: { theKey: 42 } })).toBe(42);
  });

  it('parses a function call', () => {
    const result = parse('aFunction()');
    expect(result({ aFunction: () => 42 })).toBe(42);
  });

  it('parses a function call with a single number argument', () => {
    const result = parse('aFunction(42)');
    expect(result({ aFunction: (n: number) => n})).toBe(42);
  });

  it('parses a function call with a single identifier argument', () => {
    const result = parse('aFunction(n)');
    expect(result({ n: 42, aFunction: (arg: any) => arg})).toBe(42);
  });

  it('parses a function call with a single function call argument', () => {
    const result = parse('aFunction(argFunction())');
    expect(result({
      argFunction: () => 42,
      aFunction: (arg: any) => arg
    })).toBe(42);
  });

  it('parses a function call with multiple arguments', () => {
    const result = parse('aFunction(37, n, argFunction()))');
    expect(result({
      n: 3,
      argFunction: () => 2,
      aFunction: (a1: number, a2: number, a3: number) => a1 + a2 + a3
    })).toBe(42);
  });

  it('calls methods accessed as computed properties', () => {
    const scope = {
      anObject: {
        aMember: 42,
        aFunction: function() {
          console.log('this: ', this);
          return this.aMember;
        }
      }
    };

    const result = parse('anObject["aFunction"]()');
    expect(result(scope)).toBe(42);
  });

  it('calls methods accessed as non-computed properties', () => {
    const scope = {
      anObject: {
        aMember: 42,
        aFunction: function() {
          return this.aMember;
        }
      }
    };

    const result = parse('anObject.aFunction()');
    expect(result(scope)).toBe(42);
  });

  it('binds bare functions to the scope', () => {
    const scope = {
      aFunction: function() {
        return this;
      }
    };

    const result = parse('aFunction()');
    expect(result(scope)).toBe(scope);
  });

  it('binds bar functions on locals to the locals', () => {
    const scope = {};
    const locals = {
      aFunction: function() {
        return this;
      }
    };

    const result = parse('aFunction()');
    expect(result(scope, locals)).toBe(locals);
  });

  it('parses a simple attribute assignment', () => {
    const result = parse('anAttribute = 42');
    const scope: any = {};

    result(scope);

    expect(scope.anAttribute).toBe(42);
  });

  it('can assign any primary expression', () => {
    const result = parse('anAttribute = aFunction()');
    const scope: any = { aFunction: () => 42 };

    result(scope);

    expect(scope.anAttribute).toBe(42);
  });

  it('can assign a computed object property', () => {
    const result = parse('anObject["anAttribute"] = 42');

    const scope: any = { anObject: {} };

    result(scope);

    expect(scope.anObject.anAttribute).toBe(42);
  });

  it('can assign a non-computed property', () => {
    const result = parse('anObject.anAttribute = 42');
    const scope: any = { anObject: {} };

    result(scope);

    expect(scope.anObject.anAttribute).toBe(42);
  });

  it('can assign a nested object property', () => {
    const result = parse('anArray[0].anAttribute = 42');
    const scope = { anArray: [<any>{}] };

    result(scope);

    expect(scope.anArray[0].anAttribute).toBe(42);
  });

  it('creates the objects in the assignment path that do not exist', () => {
    const result = parse('some["nested"].property.path = 42');
    const scope: any = {};

    result(scope);
    expect(scope.some.nested.property.path).toBe(42);
  });

  it('does not allow calling the function constructor', () => {
    expect(() => {
      const result = parse('aFunction.constructor("return window;")()');

      result({ aFunction: function() {} });
    }).toThrow();
  });

  it('does not allow accessing __proto__', () => {
    expect(() => {
      const result = parse('obj.__proto__');

      result({ obj: {} });
    }).toThrow();
  });

  it('does not allow calling __defineGetter__', () => {
    expect(() => {
      const result = parse('obj.__defineGetter__("evil", fn)');

      result({ obj: {}, fn: function() {} });
    }).toThrow();
  });

  it('does not allow calling __defineSetter__', () => {
    expect(() => {
      const result = parse('obj.__defineSetter__("evil", fn)');

      result({ obj: {}, fn: function() {} });
    }).toThrow();
  });

  it('does not allow calling __lookupGetter__', () => {
    expect(() => {
      const result = parse('obj.__lookupGetter__("evil")');

      result({ obj: {} });
    }).toThrow();
  });

  it('does not allow calling __lookupSetter__', () => {
    expect(() => {
      const result = parse('obj.__lookupSetter__("evil")');

      result({ obj: {} });
    }).toThrow();
  });

  it('does not allow accessing window as a computed property', () => {
    const result = parse('anObject["wnd"]');

    expect(() => result({ anObject: {wnd: window } })).toThrow();
  });

  it('does not allow accessing window as a non-computed property', () => {
    const result = parse('anObject.wnd');

    expect(() => result({ anObject: {wnd: window } })).toThrow();
  });

  it('does not allow passing window as a function argument', () => {
    const result = parse('aFunction(wnd)');

    expect(() => {
      result({ aFunction: function() {}, wnd: window });
    }).toThrow();
  });

  it('does not allow calling methods on window', () => {
    const result = parse('wnd.scrollTo(0)');

    expect(() => result({ wnd: window })).toThrow();
  });

  it('does not allow functions to return window', () => {
    const result = parse('getWnd()');
    expect(() => {
      return result({ getWnd: () => window });
    }).toThrow();
  });

  it('does not allow assigning window', () => {
    const result = parse('wnd = anObject');
    expect(() => result({ anObject: window })).toThrow();
  });

  it('does not allow referencing window', () => {
    const result = parse('wnd');

    expect(() => result({ wnd: window })).toThrow();
  });

  it('does not allow calling functions on DOM elements', () => {
    const result = parse('el.setAttribute("evil", "true")');
    expect(() => result({ el: document.documentElement })).toThrow();
  });

  it('does not allow calling aliased function constructor', () => {
    const result = parse('fnConstructor("return window;")');

    expect(() => result({ fnConstructor: (function() {}).constructor })).toThrow();
  });

  it('does not allow calling functions on Object', () => {
    const result = parse('obj.create({})');

    expect(() => result({ obj: Object})).toThrow();
  });

  it('does not allow calling call', () => {
    const result = parse('fun.call(obj)');

    expect(() => result({ fun: function() {}, obj: {} })).toThrow();
  });

  it('does not allow calling apply', () => {
    const result = parse('fun.apply(obj)');

    expect(() => result({ fun: function() {}, obj: {} })).toThrow();
  });

  it('parses a nuary +', () => {
    expect(parse('+42')()).toBe(42);
    expect(parse('+a')({ a: 42 })).toBe(42);
  });

  it('replaces undefined with zero for unary +', () => {
    expect(parse('+a')({})).toBe(0);
  });

  it('parses a unary !', () => {
    expect(parse('!true')()).toBe(false);
    expect(parse('!42')()).toBe(false);
    expect(parse('!a')({ a: false })).toBe(true);
    expect(parse('!!a')({ a: false })).toBe(false);
  });

  it('parses a unary -', () => {
    expect(parse('-42')()).toBe(-42);
    expect(parse('-a')({ a: -42 })).toBe(42);
    expect(parse('--a')({ a: -42 })).toBe(-42);
    expect(parse('-a')({})).toBe(0);
  });

  it('parses a ! in a string', () => {
    expect(parse('"!"')()).toBe('!');
  });

  it('parses a multiplication', () => {
    expect(parse('21 * 2')()).toBe(42);
  });

  it('parses a division', () => {
    expect(parse('84 / 2')()).toBe(42);
  });

  it('parses a modulo', () => {
    expect(parse('85 % 43')()).toBe(42);
  });

  it('parses several multiplicatives', () => {
    expect(parse('36 * 2 % 5')()).toBe(2);
  });

  it('parses an addition', () => {
    expect(parse('20 + 22')()).toBe(42);
  });

  it('parses a subtraction', () => {
    expect(parse('62 - 20')()).toBe(42);
  });

  it('parses multiplicatives on a higher precedence than additives', () => {
    expect(parse('2 + 8 * 5')()).toBe(42);
    expect(parse('7 + 4 * 6 + 11')()).toBe(42);
  });

  it('substitutes undefined with zero in addition', () => {
    expect(parse('a + 42')()).toBe(42);
    expect(parse('42 + a')()).toBe(42);
  });

  it('substitutes undefined with zero in subtraction', () => {
    expect(parse('a - 42')()).toBe(-42);
    expect(parse('42 - a')()).toBe(42);
  });

  it('parses relational operators', () => {
    expect(parse('1 < 2')()).toBe(true);
    expect(parse('1 > 2')()).toBe(false);

    expect(parse('1 <= 2')()).toBe(true);
    expect(parse('2 <= 2')()).toBe(true);
    expect(parse('3 <= 2')()).toBe(false);

    expect(parse('1 >= 2')()).toBe(false);
    expect(parse('2 >= 2')()).toBe(true);
    expect(parse('3 >= 2')()).toBe(true);
  });

  it('parses equality operators', () => {
    expect(parse('42 == 42')()).toBe(true);
    expect(parse('42 == "42"')()).toBe(true);
    expect(parse('43 == 42')()).toBe(false);

    expect(parse('42 != 42')()).toBe(false)
    expect(parse('42 != 43')()).toBe(true);

    expect(parse('42 === 42')()).toBe(true);
    expect(parse('42 === "42"')()).toBe(false);
    expect(parse('{} === {}')()).toBe(false);

    expect(parse('42 !== 42')()).toBe(false);
    expect(parse('42 !== "42"')()).toBe(true);
    expect(parse('{} !== {}')()).toBe(true);
  });

  it('parses relationals on a higher precedence than equality', () => {
    expect(parse('2 == "2" > 2 === "2"')()).toBe(false);
  });

  it('parses additives on a higher precedence than relationals', () => {
    expect(parse('2 + 3 < 6 - 2')()).toBe(false);
  });

  it('parses logical AND', () => {
    expect(parse('true && true')()).toBe(true);
    expect(parse('true && false')()).toBe(false);
    expect(parse('false && false')()).toBe(false);
  });

  it('parses logical OR', () => {
    expect(parse('true || true')()).toBe(true);
    expect(parse('true || false')()).toBe(true);
    expect(parse('false || false')()).toBe(false);
  });

  it('parse multiple AND\'s', () => {
    expect(parse('true && true && true')()).toBe(true);
    expect(parse('true && true && false')()).toBe(false);
  });

  it('parses multiple OR\'s', () => {
    expect(parse('true || true || true')()).toBe(true);
    expect(parse('true || true || false')()).toBe(true);
    expect(parse('false || false || true')()).toBe(true);
    expect(parse('false || false || false')()).toBe(false);
  });

  it('short-circuits AND', () => {
    let invoked = false;
    const scope = { fn: () => invoked = true };

    parse('false && fn()')(scope);

    expect(invoked).toBe(false);
  });

  it('short-circuits OR', () => {
    let invoked = false;
    const scope = { fn: () => invoked = true };

    parse('true || fn()')(scope);

    expect(invoked).toBe(false);
  });

  it('parses AND with a higher precedence than OR', () => {
    expect(parse('false && true || true')()).toBe(true);
  });

  it('parses OR with a lower precedence than equality', () => {
    expect(parse('1 === 2 || 2 === 2')()).toBe(true);
  });

  it('parses the ternary expression', () => {
    expect(parse('a === 42 ? true : false')({ a: 42 })).toBe(true);
    expect(parse('a === 42 ? true : false')({ a: 43 })).toBe(false);
  });

  it('parses OR with a higher precedence than the ternary operator', () => {
    expect(parse('0 || 1 ? 0 || 2 : 0 || 3')()).toBe(2);
  });

  it('parses nested ternaries', () => {
    expect(
      parse('a === 42 ? b === 42 ? "a and b" : "a" : c === 42 ? "c" : "none"')({
        a: 44,
        b: 43,
        c: 42
      })
    ).toBe('c');
  });

  it('parses parentheses altering precedence order', () => {
    expect(parse('21 * (3 - 1)')()).toBe(42);
    expect(parse('false && (true || true)')()).toBe(false);
    expect(parse('-((a % 2) === 0 ? 1 : 2)')({ a: 42 })).toBe(-1);
  });

  it('parses several statements', () => {
    const result = parse('a = 1; b = 2; c = 3');
    const scope = {};

    result(scope);

    expect(scope).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('returns the value of the last statement', () => {
    expect(parse('a = 1; b = 2; a + b')({})).toBe(3);
  });

  it('returns the function itself if given one', () => {
    const fn = () => 7;

    expect(parse(fn)).toBe(fn);
  });

  it('still returns a function when given no argument', () => {
    expect(parse()).toEqual(jasmine.any(Function));
  });

  it('marks integers literal', () => {
    const result = parse('42');

    expect(result.literal).toBe(true);
  });

  it('marks strings literal', () => {
    const result = parse('"abc"');

    expect(result.literal).toBe(true);
  });

  it('marks booleans literal', () => {
    const result = parse('true');

    expect(result.literal).toBe(true);
  });

  it('marks arrays literal', () => {
    const result = parse('[1, 2, aVariable]');

    expect(result.literal).toBe(true);
  });

  it('marks objects literal', () => {
    const result = parse('{ a: 1, b: aVariable }');

    expect(result.literal).toBe(true);
  });

  it('marks unary expressions non-literal', () => {
    const result = parse('!false');

    expect(result.literal).toBe(false);
  });

  it('marks binary expressions non-literal', () => {
    const result = parse('1 + 2');

    expect(result.literal).toBe(false);
  });

  it('marks integers constant', () => {
    const result = parse('42');
    expect(result.constant).toBe(true);
  });

  it('marks strings constant', () => {
    const result = parse('"abc"');
    expect(result.constant).toBe(true);
  });

  it('marks booleans constant', () => {
    const result = parse('true');
    expect(result.constant).toBe(true);
  });

  it('marks identifiers non-constant', () => {
    const result = parse('a');

    expect(result.constant).toBe(false);
  });

  it('marks arrays constant when elements are constant', () => {
    expect(parse('[1, 2, 3]').constant).toBe(true);
    expect(parse('[1, 2, [3]]').constant).toBe(true);
    expect(parse('[1, 2, a]').constant).toBe(false);
    expect(parse('[1, 2, [a]]').constant).toBe(false);
  });

  it('marks objects constant when values are constant', () => {
    expect(parse('{ a: 1, b: 2 }').constant).toBe(true);
    expect(parse('{ a: 1, b: { c: 3 } }').constant).toBe(true);
    expect(parse('{ a: 1, b: something }').constant).toBe(false);
    expect(parse('{ a: 1, b: { c: something } }').constant).toBe(false);
  });

  it('marks this as non-constant', () => {
    expect(parse('this').constant).toBe(false);
  });

  it('marks non-computed lookup constant when the object is constant', () => {
    expect(parse('{ a: 1 }.a').constant).toBe(true);
    expect(parse('obj.a').constant).toBe(false);
  });
});
