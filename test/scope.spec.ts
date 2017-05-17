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

    it('allows destroying a $watch with a removal function', () => {
      (<any>scope).aValue = 'abc';
      (<any>scope).counter = 0;

      const destroyWatch = scope.$watch(
        (scope) => (<any>scope).aValue,
        (newValue, oldValue, scope) => (<any>scope).counter++);

      scope.$digest();
      expect((<any>scope).counter).toBe(1);

      (<any>scope).aValue = 'def';
      scope.$digest();
      expect((<any>scope).counter).toBe(2);

      destroyWatch();

      (<any>scope).$digest();
      expect((<any>scope).counter).toBe(2);
    });

    it('allows destroying a $watch during digest', () => {
      (<any>scope).aValue = 'abc';

      const watchCalls: string[] = [];

      scope.$watch(
        (scope) => {
          watchCalls.push('first');
          return (<any>scope).aValue;
        });

      const destroyWatch = scope.$watch(
        (scope) => {
          watchCalls.push('second');
          destroyWatch();
        });

      scope.$watch((scope) => {
        watchCalls.push('third');
        return (<any>scope).aValue;
      });

      scope.$digest();
      expect(watchCalls).toEqual(['first', 'second', 'third', 'first', 'third']);
    });

    it('allows a $watch to destroy another during digest', () => {
      (<any>scope).aValue = 'abc';
      (<any>scope).counter = 0;

      scope.$watch(
        (scope) => (<any>scope).aValue,
        (newValue, oldValue, scope) => destroyWatch());

      const destroyWatch = scope.$watch((scope) => null);

      scope.$watch(
        (scope) => (<any>scope).aValue,
        (newValue, oldValue, scope) => (<any>scope).counter++);

      scope.$digest();
      expect((<any>scope).counter).toBe(1);
    });

    it('allows destroying several $watches during digest', () => {
      (<any>scope).aValue = 'abc';
      (<any>scope).counter = 0;

      const destroyWatch1 = scope.$watch((scope) => {
        destroyWatch1();
        destroyWatch2();
      });

      const destroyWatch2 = scope.$watch(
        (scope) => (<any>scope).aValue,
        (newValue, oldValue, scope) => (<any>scope).counter++);

      scope.$digest();
      expect((<any>scope).counter).toBe(0);
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

    it('catches exceptions in watch functions and continues', () => {
      (<any>scope).aValue = 'abc';
      (<any>scope).counter = 0;

      scope.$watch((scope) => { throw 'error'; });

      scope.$watch(
        (scope) => (<any>scope).aValue,
        (newValue, oldValue, scope) => (<any>scope).counter++);

      scope.$digest();
      expect((<any>scope).counter).toBe(1);
    });

    it('catches exceptions in listener functions and continues', () => {
      (<any>scope).aValue = 'abc';
      (<any>scope).counter = 0;

      scope.$watch(
        (scope) => (<any>scope).aValue,
        (newValue, oldValue, scope) => { throw 'Error'; });

      scope.$watch(
        (scope) => (<any>scope).aValue,
        (newValue, oldValue, scope) => (<any>scope).counter++);

      scope.$digest();
      expect((<any>scope).counter).toBe(1);
    });
  });

  describe('$apply', () => {
    let scope: Scope;

    beforeEach(() => {
      scope = new Scope();
    });

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

  describe('$evalAsync', () => {
    let scope: Scope;

    beforeEach(() => {
      scope = new Scope();
    });

    it('executes $evalAsync\'d function later in the same cycle', () => {
      (<any>scope).aValue = [1, 2, 3];
      (<any>scope).asyncEvaluated = false;
      (<any>scope).asyncEvaluatedImmediately = false;

      scope.$watch(
        (scope) => (<any>scope).aValue,
        (newValue, oldValue, scope) => {
          scope.$evalAsync(scope => (<any>scope).asyncEvaluated = true);

          (<any>scope).asyncEvaluatedImmediately = (<any>scope).asyncEvaluated;
        });

      scope.$digest();
      expect((<any>scope).asyncEvaluated).toBe(true);
      expect((<any>scope).asyncEvaluatedImmediately).toBe(false);
    });

    it('executes $evalAsync\'d functions added by watch functions', () => {
      (<any>scope).aValue = [1, 2, 3];
      (<any>scope).asyncEvaluated = false;

      scope.$watch(
        (scope) => {
          if (!(<any>scope).asyncEvaluated) {
            scope.$evalAsync((scope) => (<any>scope).asyncEvaluated = true)
          }

          return (<any>scope).aValue;
        },
        (newValue, oldValue, scope) => null);

      scope.$digest();

      expect((<any>scope).asyncEvaluated).toBe(true);
    });

    it('executes $evalAsync\'d functions even when not dirty', () => {
      (<any>scope).aValue = [1, 2, 3];
      (<any>scope).asyncEvaluatedTimes = 0;

      scope.$watch(
        (scope) => {
          if ((<any>scope).asyncEvaluatedTimes < 2) {
            scope.$evalAsync((scope) => (<any>scope).asyncEvaluatedTimes++);
          }

          return (<any>scope).aValue;
        });

      scope.$digest();

      expect((<any>scope).asyncEvaluatedTimes).toBe(2);
    });

    it('eventually halts $evalAsyncs added by watches', () => {
      (<any>scope).aValue = [1, 2, 3];

      scope.$watch((scope) => {
        scope.$evalAsync(() => null);
      });

      expect(() => scope.$digest()).toThrow();
    });

    it('schedules a digest in $evalAsync', (done) => {
      (<any>scope).aValue = 'abc';
      (<any>scope).counter = 0;

      scope.$watch(
        (scope) => (<any>scope).aValue,
        (newValue, oldValue, scope) => (<any>scope).counter++);

      scope.$evalAsync(() => null);

      expect((<any>scope).counter).toBe(0);

      setTimeout(() => {
        expect((<any>scope).counter).toBe(1);
        done();
      }, 50);
    });

    it('catches exceptions', (done) => {
      (<any>scope).aValue = 'abc';
      (<any>scope).counter = 0;

      scope.$watch(
        (scope) => (<any>scope).aValue,
        (newValue, oldValue, scope) => (<any>scope).counter++);

      scope.$evalAsync((scope) => { throw 'Error'; });

      setTimeout(() => {
        expect((<any>scope).counter).toBe(1);
        done();
      }, 50);
    });
  });

  describe('Scope phases', () => {
    let scope: Scope;

    beforeEach(() => {
      scope = new Scope();
    });

    it('should reflect the current digest phase', () => {
      (<any>scope).aValue = [1, 2, 3];

      let phaseInWatchFunction: string;
      let phaseInListenerFunction: string;
      let phaseInApplyFunction: string;

      scope.$watch(
        (scope) => {
          phaseInWatchFunction = scope.$$phase;
          return (<any>scope).aValue;
        },
        (newValue, oldValue, scope) => phaseInListenerFunction = scope.$$phase);

      scope.$apply((scope) => phaseInApplyFunction = scope.$$phase);

      expect(phaseInWatchFunction).toBe('$digest');
      expect(phaseInListenerFunction).toBe('$digest');
      expect(phaseInApplyFunction).toBe('$apply');
    });
  });

  describe('$applyAsync', () => {
    let scope: Scope;

    beforeEach(() => {
      scope = new Scope();
    });

    it('allows async $apply with $applyAsync', (done) => {
      (<any>scope).counter = 0;

      scope.$watch(
        (scope) => (<any>scope).aValue,
        (newValue, oldValue, scope) => (<any>scope).counter++);

      scope.$digest();
      expect((<any>scope).counter).toBe(1);

      scope.$applyAsync((scope) => (<any>scope).aValue = 'abc');
      expect((<any>scope).counter).toBe(1);

      setTimeout(() => {
        expect((<any>scope).counter).toBe(2);
        done();
      }, 50);
    });

    it('never executes $applyAsync\'d function in the same cycle', (done) => {
      (<any>scope).aValue = [1, 2, 3];
      (<any>scope).asyncApplied = false;

      scope.$watch(
        (scope) => (<any>scope).aValue,
        (newValue, oldValue, scope) => {
          scope.$applyAsync((scope) => (<any>scope).asyncApplied = true);
        });

      scope.$digest();
      expect((<any>scope).asyncApplied).toBe(false);

      setTimeout(() => {
        expect((<any>scope).asyncApplied).toBe(true);
        done();
      }, 50);
    });

    it('coalesces many calls to $applyAsync', (done) => {
      (<any>scope).counter = 0;

      scope.$watch((scope) => {
        (<any>scope).counter++;
        return (<any>scope).aValue;
      });

      scope.$applyAsync((scope) => (<any>scope).aValue = 'abc');

      scope.$applyAsync((scope) => (<any>scope).aValue = 'def');

      setTimeout(() => {
        expect((<any>scope).counter).toBe(2);
        done();
      }, 50);
    });

    it('cancels and flushes $applyAsync if digested first', (done) => {
      (<any>scope).counter = 0;

      scope.$watch((scope) => {
        (<any>scope).counter++;
        return (<any>scope).aValue;
      });

      scope.$applyAsync((scope) => (<any>scope).aValue = 'abc');
      scope.$applyAsync((scope) => (<any>scope).aValue = 'def');

      scope.$digest();
      expect((<any>scope).counter).toBe(2);
      expect((<any>scope).aValue).toBe('def');

      setTimeout(() => {
        expect((<any>scope).counter).toBe(2);
        done();
      }, 50);
    });

    it('catches exceptions', (done) => {
      scope.$applyAsync((scope) => { throw 'Error'; });
      scope.$applyAsync((scope) => { throw 'Error'; });
      scope.$applyAsync((scope) => (<any>scope).applied = true);

      setTimeout(() => {
        expect((<any>scope).applied).toBe(true);
        done();
      }, 50);
    });
  });

  describe('$$postDigest', () => {
    let scope: Scope;

    beforeEach(() => {
      scope = new Scope();
    });

    it('runs after each digest', () => {
      (<any>scope).counter = 0;

      scope.$$postDigest(() => (<any>scope).counter++);

      expect((<any>scope).counter).toBe(0);

      scope.$digest();
      expect((<any>scope).counter).toBe(1);

      scope.$digest();
      expect((<any>scope).counter).toBe(1);
    });

    it('does is not included in the digest', () => {
      (<any>scope).aValue = 'original value';

      scope.$$postDigest(() => (<any>scope).aValue = 'changed value');

      scope.$watch(
        (scope) => (<any>scope).aValue,
        (newValue, oldValue, scope) => (<any>scope).watchedValue = newValue);

      scope.$digest();
      expect((<any>scope).watchedValue).toBe('original value');

      scope.$digest();
      expect((<any>scope).watchedValue).toBe('changed value');
    });

    it('catches exceptions', () => {
      let didRun = false;

      scope.$$postDigest(() => { throw 'Error'; });
      scope.$$postDigest(() => didRun = true);

      scope.$digest();
      expect(didRun).toBe(true);
    });
  });

  describe('$watchGroup', () => {
    let scope: Scope;

    beforeEach(() => {
      scope = new Scope();
    });

    it('takes watches as an array and calls listener with arrays', () => {
      let gotNewValues, gotOldValues;

      (<any>scope).aValue = 1;

      (<any>scope).anotherValue = 2;

      scope.$watchGroup([
          (scope) => (<any>scope).aValue,
          (scope) => (<any>scope).anotherValue
        ],
        (newValues, oldValues, scope) => {
          gotNewValues = newValues;
          gotOldValues = oldValues
        });

      scope.$digest();

      expect(gotNewValues).toEqual([1, 2]);

      expect(gotOldValues).toEqual([1, 2]);
    });

    it('only calls listener once per digest', () => {
      let counter = 0;

      (<any>scope).aValue = 1;
      (<any>scope).anotherValue = 2;

      scope.$watchGroup([
          (scope) => (<any>scope).aValue,
          (scope) => (<any>scope).anotherValue
        ],
        (newValues, oldValues, scope) => counter++);

      scope.$digest();

      expect(counter).toEqual(1);
    });

    it('uses the same array of old and new values on first run', () => {
      let gotNewValues, gotOldValues;

      (<any>scope).aValue = 1;
      (<any>scope).anotherValue = 2;

      scope.$watchGroup([
          (scope) => (<any>scope).aValue,
          (scope) => (<any>scope).anotherValue
        ],
        (newValues, oldValues, scope) => {
          gotNewValues = newValues;
          gotOldValues = oldValues;
        });

      scope.$digest();

      expect(gotNewValues).toBe(gotOldValues);
    });

    it('uses different arrays for old and new values on subsequent runs', () => {
      let gotNewValues, gotOldValues;

      (<any>scope).aValue = 1;
      (<any>scope).anotherValue = 2;

      scope.$watchGroup([
          (scope) => (<any>scope).aValue,
          (scope) => (<any>scope).anotherValue
        ],
        (newValues, oldValues, scope) => {
          gotOldValues = oldValues;
          gotNewValues = newValues;
        });

      scope.$digest();

      (<any>scope).anotherValue = 3;
      scope.$digest();

      expect(gotNewValues).toEqual([1, 3]);
      expect(gotOldValues).toEqual([1, 2]);
    });

    it('calls the listener once when the watch array is empty', () => {
      let gotNewValues, gotOldValues;

      scope.$watchGroup([], (newValues, oldValues, scope) => {
        gotNewValues = newValues;
        gotOldValues = oldValues;
      });

      scope.$digest();

      expect(gotNewValues).toEqual([]);
      expect(gotOldValues).toEqual([]);
    });
  });
});












