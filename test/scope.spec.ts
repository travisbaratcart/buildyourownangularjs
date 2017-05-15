import * as _ from 'lodash';
import { Scope } from '../src/scope';

describe('Scope', () => {
  it('can be constructed and used as an object', () => {
    const scope = new Scope();
    (<any>scope).aProperty = 1;
    expect((<any>scope).aProperty).toBe(1);
  });

  describe('digest', () => {
    let scope: Scope;

    beforeEach(() => {
      scope = new Scope();
    });

    it('calls the listener function of a watch on the first $digest', () => {
      const watchFunction = () => 'wat';
      const listenerFunction = jasmine.createSpy('spyFunction');
      scope.$watch(watchFunction, listenerFunction);

      scope.$digest();

      expect(listenerFunction).toHaveBeenCalled();
    });

    it('calls the watch function with the scope as the argument', () => {
      const watchFunction = jasmine.createSpy('watchFunction');
      const listenerFunction = jasmine.createSpy('listenerFunction');

      scope.$watch(watchFunction, listenerFunction);

      scope.$digest();

      expect(watchFunction).toHaveBeenCalledWith(scope);
    });

    it('calls the listener function when the value changes', () => {
      (<any>scope).someValue = 'a';
      (<any>scope).counter = 0;

      scope.$watch(
        (scope: Scope) => (<any>scope).someValue,
        (newValue: any, oldValue: any, scope: Scope) => (<any>scope).counter++);

      expect((<any>scope).counter).toBe(0);

      scope.$digest();

      expect((<any>scope).counter).toBe(1);

      scope.$digest();

      expect((<any>scope).counter).toBe(1);

      (<any>scope).someValue = 'b';
      scope.$digest();

      expect((<any>scope).counter).toBe(2);
    });

    it('calls listener when watch value is first undefined', () => {
      (<any>scope).counter = 0;

      scope.$watch(
        (scope) => (<any>scope).someValue,
        (newValue, oldValue, scope) => (<any>scope).counter++)

      scope.$digest();

      expect((<any>scope).counter).toBe(1);
    });

    it('may have watchers that omit the listener function', () => {
      const watchFunction = jasmine.createSpy('watchFunction').and.returnValue('something');
      scope.$watch(watchFunction);

      scope.$digest();

      expect(watchFunction).toHaveBeenCalled();
    });

    it('triggers chained watchers in the same digest', () => {
      (<any>scope).name = 'Jane';

      scope.$watch(
        (scope) => (<any>scope).nameUpper,
        (newValue, oldValue, scope) => {
          if (newValue) {
            (<any>scope).initial = newValue.substring(0, 1) + '.';
          }
        });

      scope.$watch(
        (scope) => (<any>scope).name,
        (newValue, oldValue, scope) => {
          if (newValue) {
            (<any>scope).nameUpper = newValue.toUpperCase();
          }
        })

      scope.$digest();
      expect((<any>scope).initial).toBe('J.');

      (<any>scope).name = 'Bob';
      scope.$digest();
      expect((<any>scope).initial).toBe('B.');
    });

    it('gives up on the watches after 10 iterations', () => {
      (<any>scope).counterA = 0;
      (<any>scope).counterB = 0;

      scope.$watch(
        (scope) => (<any>scope).counterB,
        (newValue, oldValue, scope) => (<any>scope).counterA++);

      scope.$watch(
        (scope) => (<any>scope).counterA,
        (newValue, oldValue, scope) => (<any>scope).counterB++);

      expect(() => scope.$digest()).toThrow();
    });

    it('ends the digest when the last watch is clean', () => {
      (<any>scope).array = _.range(100);

      let watchExecutions = 0;

      _.times(100, i => {
        scope.$watch(
          scope => {
            watchExecutions++;
            return (<any>scope).array[i];
          },
          (newValue, oldValue, scope) => null)
      });

      scope.$digest();
      expect(watchExecutions).toBe(200);

      (<any>scope).array[0] = 42;
      scope.$digest();
      expect(watchExecutions).toBe(301);
    });

    it('does not end digest so that new watches are not run', () => {
      (<any>scope).aValue = 'abc';
      (<any>scope).counter = 0;

      scope.$watch(
        (scope) => (<any>scope).aValue,
        (newValue, oldValue, scope) => {
          scope.$watch(
            (scope) => (<any>scope).aValue,
            (newValue, oldValue, scope) => (<any>scope).counter++);
        })

      scope.$digest();

      expect((<any>scope).counter).toBe(1);
    });

    it('compares based on value if enabled', () => {
      (<any>scope).aValue = [1, 2, 3];
      (<any>scope).counter = 0;

      scope.$watch(
        (scope) => (<any>scope).aValue,
        (newValue, oldValue, scope) => (<any>scope).counter++,
        true);

      scope.$digest();
      expect((<any>scope).counter).toBe(1);

      (<any>scope).aValue.push(4);
      scope.$digest();
      expect((<any>scope).counter).toBe(2);
    });

    it('correctly handles NaN', () => {
      (<any>scope).number = 0 / 0; // NaN
      (<any>scope).counter = 0;

      scope.$watch(
        (scope) => (<any>scope).number,
        (newValue, oldValue, scope) => (<any>scope).counter++);

      scope.$digest();
      expect((<any>scope).counter).toBe(1);

      scope.$digest();
      expect((<any>scope).counter).toBe(1);
    });
  });

  describe('$eval', () => {
    let scope: Scope;

    beforeEach(() => {
      scope = new Scope();
    });

    it('executes $eval\'d function and returns result', () => {
      (<any>scope).aValue = 42;

      const result = scope.$eval((scope) => (<any>scope).aValue);

      expect(result).toBe(42);
    });

    it('passes the second $eval argument straight through', () => {
      (<any>scope).aValue = 42;

      const result = scope.$eval(
        (scope, arg) => (<any>scope).aValue + arg,
        2);

      expect(result).toBe(44);
    });
  });

  describe('$apply', () => {
    let scope: Scope;

    beforeEach(() => {
      scope = new Scope();
    })

    it('executes the $apply\'d function and starts the digest', () => {
      (<any>scope).aValue = 'someValue';
      (<any>scope).counter = 0;

      scope.$watch(
        () => (<any>scope).aValue,
        (newValue, oldValue, scope) => (<any>scope).counter++);

      scope.$digest();
      expect((<any>scope).counter).toBe(1);

      scope.$apply((scope) => (<any>scope).aValue = 'someOtherValue');

      expect((<any>scope).counter).toBe(2);
    });
  });
});












