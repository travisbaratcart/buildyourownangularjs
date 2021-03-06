'use strict';
import{ hashKey, HashMap } from '../src/hash';

describe('hash', () => {
  describe('hashkey', () => {
    it('is undefined:undefined for undefined', () => {
      expect(hashKey(undefined)).toBe('undefined:undefined');
    });

    it('is object:null for null', () => {
      expect(hashKey(null)).toBe('object:null');
    });

    it('is boolean:true for true', () => {
      expect(hashKey(true)).toBe('boolean:true');
    });

    it('is boolean:false for true', () => {
      expect(hashKey(false)).toBe('boolean:false');
    });

    it('is number:42 for 42', () => {
      expect(hashKey(42)).toBe('number:42');
    });

    it('is string:42 for "42"', () => {
      expect(hashKey('42')).toBe('string:42');
    });

    it('is object:[unique id] for objects', () => {
      expect(hashKey({})).toMatch(/^object:\S+$/);
    });

    it('is the same key when asked for the same object many times', () => {
      const obj = {};

      expect(hashKey(obj)).toBe(hashKey(obj));
    });

    it('does not change when object value changes', () => {
      const obj = { a: 42 };
      const hash1 = hashKey(obj);

      obj.a = 43;

      const hash2 = hashKey(obj);
      expect(hash1).toBe(hash2);
    });

    it('is not the same for different objects even with the same value', () => {
      const obj1 = { a: 42 };
      const obj2 = { a: 42 };

      expect(hashKey(obj1)).not.toBe(hashKey(obj2));
    });

    it('is function:[unique id] for functions', () => {
      const func = function(a: any) { return a; };

      expect(hashKey(func)).toMatch(/^function:\S+$/);
    });

    it('is the same key when asked for the same function many times', () => {
      const func = function() { };

      expect(hashKey(func)).toBe(hashKey(func));
    });

    it('is not the same for two equivalent functions', () => {
      const fn1 = function() { return 42; };
      const fn2 = function() { return 42; };

      expect(hashKey(fn1)).not.toBe(hashKey(fn2));
    });

    it('stores the hash key in the $$hashKey attribute', () => {
      const obj: any = { a: 42 };
      const hash = hashKey(obj);

      expect(obj.$$hashKey).toMatch(hash.match(/^object:(\S+)$/)[1]);
    });

    it('uses preassigned $$hashKey', () => {
      expect(hashKey({ $$hashKey: 42 })).toBe('object:42');
    });

    it('supports a function $$hashKey', () => {
      expect(hashKey({ $$hashKey: () => 42 })).toEqual('object:42');
    });

    it('calls the function $$hashKey as a method with the correct context', () => {
      expect(hashKey({
        myKey: 42,
        $$hashKey: function() {
          return this.myKey;
        }
      })).toBe('object:42');
    });
  });

  describe('HashMap', () => {
    it('supports put and get of primitives', () => {
      const map = new HashMap();
      map.put(42, 'fourty two');

      expect(map.get(42)).toEqual('fourty two');
    });

    it('supports put and get of objects with hashKey semantics', () => {
      const map = new HashMap();

      const obj = {};
      map.put(obj, 'my value');

      expect(map.get(obj)).toEqual('my value');
      expect(map.get({})).toBeUndefined();
    });

    it('supports remove', () => {
      const map = new HashMap();

      map.put(42, 'fourty two');

      map.remove(42);
      expect(map.get(42)).toBeUndefined();
    });

    it('returns value from remove', () => {
      const map = new HashMap();
      map.put(42, 'fourty two');
      expect(map.remove(42)).toBe('fourty two');
    });
  });
});
