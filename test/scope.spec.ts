import * as _ from 'lodash';
import {
  Scope,
  IEvent
} from '../src/scope';

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

    it('accepts expressions for watch functions', () => {
      let theValue;

      (<any>scope).aValue = 42;
      scope.$watch('aValue', (newValue, oldValue, scope) => {
        theValue = newValue;
      });

      scope.$digest();

      expect(theValue).toBe(42);
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

    it('can be deregistered', () => {
      let counter = 0;

      (<any>scope).aValue = 1;
      (<any>scope).anotherValue = 2;

      const destroyGroup = scope.$watchGroup([
          (scope) => (<any>scope).aValue,
          (scope) => (<any>scope).anotherValue
        ],
        (newValues, oldValues, scope) => {
          counter++;
        });

      scope.$digest();

      (<any>scope).anotherValue = 3;
      destroyGroup();
      scope.$digest();

      expect(counter).toBe(1);
    });

    it('does not call the zero-watch listener when deregistered first', () => {
      let counter = 0;

      const destroyGroup = scope.$watchGroup([], (newValues, oldValues, scope) => {
        counter++;
      });

      destroyGroup();

      scope.$digest();

      expect(counter).toBe(0);
    });
  });

  describe('inheritance', () => {
    it('inherits the parent\'s properties', () => {
      const parent = new Scope();

      (<any>parent).aValue = [1, 2, 3];

      const child = parent.$new();

      expect((<any>child).aValue).toEqual([1, 2, 3]);
    });

    it('does not cause a parent to inherit its properties', () => {
      const parent = new Scope();

      const child = parent.$new();
      (<any>child).aValue = [1, 2, 3];

      expect((<any>parent).aValue).toBeUndefined();
    });

    it('inherits the parent\'s properties whenever they are defined', () => {
      const parent = new Scope();

      const child = parent.$new();

      (<any>parent).aValue = [1, 2, 3];

      expect((<any>child).aValue).toEqual([1, 2, 3]);
    });

    it('can manipulate a parent scope\'s property', () => {
      const parent = new Scope();
      const child = parent.$new();
      (<any>parent).aValue = [1, 2, 3];

      (<any>child).aValue.push(4);

      expect((<any>child).aValue).toEqual([1, 2, 3, 4]);
      expect((<any>parent).aValue).toEqual([1, 2, 3, 4]);
    });

    it('can watch a property in the parent', () => {
      const parent = new Scope();
      const child = parent.$new();

      (<any>parent).aValue = [1, 2, 3];
      (<any>child).counter = 0;

      child.$watch(
        (scope) => (<any>scope).aValue,
        (newValue, oldValue, scope) => (<any>scope).counter++,
        true);

      child.$digest();
      expect((<any>child).counter).toBe(1);

      (<any>parent).aValue.push(4);

      child.$digest();
      expect((<any>child).counter).toBe(2);
    });

    it('can be nested at any depth', () => {
      const a = new Scope();
      const aa = a.$new();
      const aaa = aa.$new();
      const aab = aa.$new();
      const ab = a.$new();
      const abb = ab.$new();

      (<any>a).value = 1;

      expect((<any>aa).value).toBe(1);
      expect((<any>aaa).value).toBe(1);
      expect((<any>aab).value).toBe(1);
      expect((<any>ab).value).toBe(1);
      expect((<any>abb).value).toBe(1);

      (<any>ab).anotherValue = 2;

      expect((<any>abb).anotherValue).toBe(2);
      expect((<any>aa).anotherValue).toBeUndefined();
      expect((<any>aaa).anotherValue).toBeUndefined();
    });

    it('shadows a parent\'s property with the same name', () => {
      const parent = new Scope();
      const child = parent.$new();

      (<any>parent).name = 'Joe';
      (<any>child).name = 'Jill';

      expect((<any>child).name).toBe('Jill');
      expect((<any>parent).name).toBe('Joe');
    });

    it('does not shadow member of parent scope\'s attributes', () => {
      const parent = new Scope();
      const child = parent.$new();

      (<any>parent).user = { name: 'Joe' };
      (<any>child).user.name = 'Jill';

      expect((<any>child).user.name).toBe('Jill');
      expect((<any>parent).user.name).toBe('Jill');
    });

    it('does not digest its parent(s)', () => {
      const parent = new Scope();
      const child = parent.$new();

      (<any>parent).aValue = 'abc';
      parent.$watch(
        (scope) => (<any>scope).aValue,
        (newValue, oldValue, scope) => (<any>scope).aValueWas = newValue);

      child.$digest();
      expect((<any>child).aValueWas).toBeUndefined();
    });

    it('keeps a record of its children', () => {
      const parent = new Scope();
      const child1 = parent.$new();
      const child2 = parent.$new();
      const child2_1 = child2.$new();

      expect(parent.$$children.length).toBe(2);
      expect(parent.$$children[0]).toBe(child1);
      expect(parent.$$children[1]).toBe(child2);

      expect(child1.$$children.length).toBe(0);

      expect(child2.$$children.length).toBe(1);
      expect(child2.$$children[0]).toBe(child2_1);
    });

    it('digests its children', () => {
      const parent = new Scope();
      const child = parent.$new();

      (<any>parent).aValue = 'abc';

      child.$watch(
        (scope) => (<any>scope).aValue,
        (newValue, oldValue, scope) => (<any>scope).aValueWas = newValue);

      parent.$digest();
      expect((<any>child).aValueWas).toBe('abc');
    });

    it('digests from root on $apply', () => {
      const parent = new Scope();
      const child = parent.$new();
      const child2 = child.$new();

      (<any>parent).aValue = 'abc';
      (<any>parent).counter = 0;

      parent.$watch(
        (scope) => (<any>scope).aValue,
        (newValue, oldValue, scope) => (<any>scope).counter++);

      child2.$apply(() => null);

      expect((<any>parent).counter).toBe(1);
    });

    it('schedules a digest from root on $evalAsync', (done) => {
      const parent = new Scope();
      const child = parent.$new();
      const child2 = child.$new();

      (<any>parent).aValue = 'abc';
      (<any>parent).counter = 0;

      parent.$watch(
        (scope) => (<any>scope).aValue,
        (newValue, oldValue, scope) => (<any>scope).counter++);

      child2.$evalAsync(() => null);

      setTimeout(() => {
        expect((<any>parent).counter).toBe(1);
        done();
      }, 50);
    });

    it('does not have access to parent attributes when isolated', () => {
      const parent = new Scope();
      const child = parent.$new(true);

      (<any>parent).aValue = 'abc';

      expect((<any>child).aValue).toBeUndefined();
    });

    it('cannot watch parent attributes when isolated', () => {
      const parent = new Scope();
      const child = parent.$new(true);

      (<any>parent).aValue = 'abc';

      child.$watch(
        (scope) => (<any>scope).aValue,
        (newValue, oldValue, scope) => (<any>scope).aValueWas = newValue);

      child.$digest();

      expect((<any>child).aValueWas).toBeUndefined();
    });

    it('digests its isolated children', () => {
      const parent = new Scope();
      const child = parent.$new(true);

      (<any>child).aValue = 'abc';

      child.$watch(
        (scope) => (<any>scope).aValue,
        (newValue, oldValue, scope) => (<any>scope).aValueWas = newValue);

      parent.$digest();

      expect((<any>child).aValueWas).toBe('abc');
    });

    it('digests from the root on $apply when isolated', () => {
      const parent = new Scope();
      const child = parent.$new(true);
      const child2 = child.$new();

      (<any>parent).aValue = 'abc';
      (<any>parent).counter = 0;

      parent.$watch(
        (scope) => (<any>scope).aValue,
        (newValue, oldValue, scope) => (<any>scope).counter++);

      child2.$apply(() => null);

      expect((<any>parent).counter).toBe(1);
    });

    it('schedules a digest from root on $evalAsync when isolated', (done) => {
      const parent = new Scope();
      const child = parent.$new(true);
      const child2 = child.$new();

      (<any>parent).aValue = 'abc';
      (<any>parent).counter = 0;

      parent.$watch(
        (scope) => (<any>scope).aValue,
        (newValue, oldValue, scope) => (<any>scope).counter++);

      child2.$evalAsync(() => null);

      setTimeout(() => {
        expect((<any>parent).counter).toBe(1);
        done();
      }, 50);
    });

    it('executes $evalAsync functions on isolate scopes', (done) => {
      const parent = new Scope();
      const child = parent.$new(true);

      child.$evalAsync((scope) => (<any>scope).didEvalAsync = true);

      setTimeout(() => {
        expect((<any>child).didEvalAsync).toBe(true);
        done();
      }, 50);
    });

    it('executes $$postDigest functions on isolated scopes', () => {
      const parent = new Scope();
      const child = parent.$new();

      child.$$postDigest(() => (<any>child).didPostDigest = true);

      child.$digest();

      expect((<any>child).didPostDigest).toBe(true);
    });

    it('can take some other scope as the parent', () => {
      const prototypeParent = new Scope();

      const hierarchyParent = new Scope();
      const child = prototypeParent.$new(false, hierarchyParent);

      (<any>prototypeParent).a = 42;
      // expect((<any>child).a).toBe(42);

      (<any>child).counter = 0;
      child.$watch((scope) => {
        (<any>scope).counter++
      });

      prototypeParent.$digest();

      expect((<any>child).counter).toBe(0);

      hierarchyParent.$digest();
      expect((<any>child).counter).toBe(2);
    });
  });

  describe('$destroy', () => {
    let parent: Scope;
    let scope: Scope;
    let child: Scope;

    beforeEach(() => {
      parent = new Scope();
      scope = parent.$new();
      child = scope.$new();
    });

    it('is no longer digested when $destroy has been called', () => {
      (<any>child).aValue = [1, 2, 3];
      (<any>child).counter = 0;

      child.$watch(
        (scope) => (<any>scope).aValue,
        (newValue, oldValue, scope) => (<any>scope).counter++,
        true);

      parent.$digest();
      expect((<any>child).counter).toBe(1);

      (<any>child).aValue.push(4);
      parent.$digest();
      expect((<any>child).counter).toBe(2);

      child.$destroy();
      (<any>child).aValue.push(5);
      parent.$digest();
      expect((<any>child).counter).toBe(2);
    });

    it('fires a $destroy event when destroyed', () => {
      const listener = jasmine.createSpy('listener');
      scope.$on('$destroy', listener);

      scope.$destroy();

      expect(listener).toHaveBeenCalled();
    });

    it('fires $destroy on children destroyed', () => {
      const listener = jasmine.createSpy('listener');

      child.$on('$destroy', listener);

      scope.$destroy();

      expect(listener).toHaveBeenCalled();
    });

    it('no longer calls event listeners after destroyed', () => {
      const listener = jasmine.createSpy('listener');
      scope.$on('someEvent', listener);

      scope.$destroy();

      scope.$emit('someEvent');

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('$watchCollection', () => {
    let scope: Scope;

    beforeEach(() => {
      scope = new Scope();
    });

    it('works like a normal watch for non-collections', () => {
      let valueProvided;

      (<any>scope).aValue = 42;
      (<any>scope).counter = 0;

      scope.$watchCollection(
        (scope) => (<any>scope).aValue,
        (newValue, oldValue, scope) => {
          valueProvided = newValue;
          (<any>scope).counter++;
        });

      scope.$digest();
      expect((<any>scope).counter).toBe(1);
      expect(valueProvided).toBe((<any>scope).aValue);

      (<any>scope).aValue = 43;
      scope.$digest();
      expect((<any>scope).counter).toBe(2);

      scope.$digest();
      expect((<any>scope).counter).toBe(2);
    });

    it('works like a normal watch for NaNs', () => {
      (<any>scope).aValue = 0/0; // NaN
      (<any>scope).counter = 0;

      scope.$watchCollection(
        (scope) => (<any>scope).aValue,
        (newValue, oldValue, scope) => (<any>scope).counter++);

        scope.$digest();
        expect((<any>scope).counter).toBe(1);

        scope.$digest();
        expect((<any>scope).counter).toBe(1);
    });

    it('notices when the value becomes an array', () => {
      (<any>scope).counter = 0;

      scope.$watchCollection(
        (scope) => (<any>scope).array,
        (newValue, oldValue, scope) => (<any>scope).counter++);

      scope.$digest();
      expect((<any>scope).counter).toBe(1);

      (<any>scope).array = [1, 2, 3];
      scope.$digest();
      expect((<any>scope).counter).toBe(2);

      scope.$digest();
      expect((<any>scope).counter).toBe(2);
    });

    it('notices when an item is added to an array', () => {
      (<any>scope).array = [1, 2, 3];
      (<any>scope).counter = 0;

      scope.$watchCollection(
        (scope) => (<any>scope).array,
        (newValue, oldValue, scope) => (<any>scope).counter++);

      scope.$digest()
      expect((<any>scope).counter).toBe(1);

      (<any>scope).array.push(4);
      scope.$digest();
      expect((<any>scope).counter).toBe(2);

      scope.$digest();
      expect((<any>scope).counter).toBe(2);
    });

    it('notices when an item is removed from an array', () => {
      (<any>scope).array = [1, 2, 3];
      (<any>scope).counter = 0;

      scope.$watchCollection(
        (scope) => (<any>scope).array,
        (newValue, oldValue, scope) => (<any>scope).counter++);

      scope.$digest();
      expect((<any>scope).counter).toBe(1);

      (<any>scope).array.shift();
      scope.$digest();
      expect((<any>scope).counter).toBe(2);

      scope.$digest();
      expect((<any>scope).counter).toBe(2);
    });

    it('notices an item replaced in an array', () => {
      (<any>scope).array = [1, 2, 3];
      (<any>scope).counter = 0;

      scope.$watchCollection(
        (scope) => (<any>scope).array,
        (newValue, oldValue, scope) => (<any>scope).counter++);

      scope.$digest();
      expect((<any>scope).counter).toBe(1);

      (<any>scope).array[1] = 42;

      scope.$digest();

      expect((<any>scope).counter).toBe(2);

      scope.$digest();

      expect((<any>scope).counter).toBe(2);
    });

    it('notices an item replaced in an array', () => {
      (<any>scope).array = [2, 1, 3];
      (<any>scope).counter = 0;

      scope.$watchCollection(
        (scope) => (<any>scope).array,
        (newValue, oldValue, scope) => (<any>scope).counter++);

      scope.$digest();
      expect((<any>scope).counter).toBe(1);

      (<any>scope).array.sort();
      scope.$digest();

      expect((<any>scope).counter).toBe(2);
    });

    it('does not fail on NaNs in arrays', () => {
      (<any>scope).array = [2, NaN, 3];
      (<any>scope).counter = 0;

      scope.$watchCollection(
        (scope) => (<any>scope).array,
        (newValue, oldValue, scope) => (<any>scope).counter++);

      scope.$digest();
      expect((<any>scope).counter).toBe(1);
    });

    it('notices an item replaced in an arguments object', () => {
      (function(a: any, b: any, c: any) { (<any>scope).arrayLike = arguments })(1, 2, 3);

      (<any>scope).counter = 0;

      scope.$watchCollection(
        (scope) => (<any>scope).arrayLike,
        (newValue, oldValue, scope) => (<any>scope).counter++);

      scope.$digest();
      expect((<any>scope).counter).toBe(1);

      (<any>scope).arrayLike[1] = 42;
      scope.$digest();
      expect((<any>scope).counter).toBe(2);

      scope.$digest();
      expect((<any>scope).counter).toBe(2);
    });

    it('notices an item replaced in a NodeList object', () => {
      document.documentElement.appendChild(document.createElement('div'));
      (<any>scope).arrayLike = document.getElementsByTagName('div');
      (<any>scope).counter = 0;

      scope.$watchCollection(
        (scope) => (<any>scope).arrayLike,
        (newValue, oldValue, scope) => (<any>scope).counter++);

      scope.$digest();
      expect((<any>scope).counter).toBe(1);

      document.documentElement.appendChild(document.createElement('div'));
      scope.$digest();
      expect((<any>scope).counter).toBe(2);

      scope.$digest();
      expect((<any>scope).counter).toBe(2);
    });

    it('notices when the value becomes an object', () => {
      (<any>scope).counter = 0;

      scope.$watchCollection(
        (scope) => (<any>scope).obj,
        (newValue, oldValue, scope) => (<any>scope).counter++);

      scope.$digest();
      expect((<any>scope).counter).toBe(1);

      (<any>scope).obj = { a: 1 };

      scope.$digest();
      expect((<any>scope).counter).toBe(2);

      scope.$digest()
      expect((<any>scope).counter).toBe(2);
    });

    it('notices when an attribute is added to an object', () => {
      (<any>scope).counter = 0;
      (<any>scope).obj = { a: 1 };

      scope.$watchCollection(
        (scope) => (<any>scope).obj,
        (newValue, oldValue, scope) => (<any>scope).counter++);

      scope.$digest()      ;
      expect((<any>scope).counter).toBe(1);

      (<any>scope).obj.b = 2;
      scope.$digest();
      expect((<any>scope).counter).toBe(2);

      scope.$digest();
      expect((<any>scope).counter).toBe(2);
    });

    it('notices when an attribute is changed in an object', () => {
      (<any>scope).counter = 0;
      (<any>scope).obj = { a: 1 };

      scope.$watchCollection(
        (scope) => (<any>scope).obj,
        (newValue, oldValue, scope) => (<any>scope).counter++);

        scope.$digest();
        expect((<any>scope).counter).toBe(1);

        (<any>scope).obj.a = 2;

        scope.$digest();
        expect((<any>scope).counter).toBe(2);

        scope.$digest();
        expect((<any>scope).counter).toBe(2);
    });

    it('does not fail on NaN attributes in objects', () => {
      (<any>scope).counter = 0;
      (<any>scope).obj = { a: NaN };

      scope.$watchCollection(
        (scope) => (<any>scope).obj,
        (newValue, oldValue, scope) => (<any>scope).counter++);

      scope.$digest();
      expect((<any>scope).counter).toBe(1);
    });

    it('notices when an attribute is removed from an objectd', () => {
      (<any>scope).counter = 0;
      (<any>scope).obj = { a: 1 };

      scope.$watchCollection(
        (scope) => (<any>scope).obj,
        (newValue, oldValue, scope) => (<any>scope).counter++);

      scope.$digest();
      expect((<any>scope).counter).toBe(1);

      delete (<any>scope).obj.a;
      scope.$digest();
      expect((<any>scope).counter).toBe(2);

      scope.$digest();
      expect((<any>scope).counter).toBe(2);
    });

    it('gives the old non-collection value to listeners', () => {
      (<any>scope).aValue = 42;
      let oldValueGiven: any;

      scope.$watchCollection(
        (scope) => (<any>scope).aValue,
        (newValue, oldValue, scope) => oldValueGiven = oldValue);

      scope.$digest();

      (<any>scope).aValue = 43;
      scope.$digest();

      expect(oldValueGiven).toBe(42);
    });

    it('gives the old array value to listeners', () => {
      (<any>scope).aValue = [1, 2, 3];
      let oldValueGiven: any;

      scope.$watchCollection(
        (scope) => (<any>scope).aValue,
        (newValue, oldValue, scope) => oldValueGiven = oldValue);

      scope.$digest();

      (<any>scope).aValue.push(4);
      scope.$digest();

      expect(oldValueGiven).toEqual([1, 2, 3]);
    });

    it('gives the old object value to listeners', () => {
      (<any>scope).aValue = { a: 1, b: 2 };
      let oldValueGiven: any;

      scope.$watchCollection(
        (scope) => (<any>scope).aValue,
        (newValue, oldValue, scope) => oldValueGiven = oldValue);

      scope.$digest();

      (<any>scope).aValue.c = 3;
      scope.$digest();

      expect(oldValueGiven).toEqual({ a: 1, b: 2 });
    });

    it('uses the new value as the old value on the first digest', () => {
      (<any>scope).aValue = { a: 1, b: 2 };
      let oldValueGiven: any;

      scope.$watchCollection(
        (scope) => (<any>scope).aValue,
        (newValue, oldValue, scope) => oldValueGiven = oldValue);

      scope.$digest();

      expect(oldValueGiven).toEqual({ a: 1, b: 2});
    });

    it('accepts expressions for watch functions', () => {
      let theValue: any;

      (<any>scope).arr = [1, 2, 3];

      scope.$watchCollection('arr', (newValue, oldValue, scope) => {
        theValue = newValue;
      });

      scope.$digest();

      expect(theValue).toEqual([1, 2, 3]);
    })
  });

  describe('events', () => {
    let parent: Scope;
    let scope: Scope;
    let child: Scope;
    let isolatedChild: Scope;

    beforeEach(() => {
      parent = new Scope();
      scope = parent.$new();
      child = scope.$new();
      isolatedChild = scope.$new(true);
    });

    it('allows registering listeners', () => {
      const listener1 = () => 0;
      const listener2 = () => 0;
      const listener3 = () => 0;

      scope.$on('someEvent', listener1);
      scope.$on('someEvent', listener2);
      scope.$on('someOtherEvent', listener3);

      expect((<any>scope).$$listeners).toEqual({
        someEvent: [listener1, listener2],
        someOtherEvent: [listener3]
      });
    });

    it('registers different listeners for every scope', () => {
      const listener1 = () => 0;
      const listener2 = () => 0;
      const listener3 = () => 0;

      scope.$on('someEvent', listener1);
      child.$on('someEvent', listener2);
      isolatedChild.$on('someEvent', listener3);

      expect((<any>scope).$$listeners).toEqual({ someEvent: [listener1] });
      expect((<any>child).$$listeners).toEqual({ someEvent: [listener2] });
      expect((<any>isolatedChild).$$listeners).toEqual({ someEvent: [listener3] });
    });

    ['$emit', '$broadcast'].forEach(method => {
      it(`calls the listeners of the matching event on ${method}`, () => {
        const listener1 = jasmine.createSpy('listener1');
        const listener2 = jasmine.createSpy('listener2');

        scope.$on('someEvent', listener1);
        scope.$on('someOtherEvent', listener2);

        (<any>scope)[method]('someEvent');

        expect(listener1).toHaveBeenCalled();
        expect(listener2).not.toHaveBeenCalled();
      });

      it(`passes an event object with a name to listeners on ${method}`, () => {
        const listener = jasmine.createSpy('listener');

        scope.$on('someEvent', listener);

        (<any>scope)[method]('someEvent');

        expect(listener).toHaveBeenCalled();
        expect(listener.calls.mostRecent().args[0].name).toEqual('someEvent');
      });

      it(`passes the same event object to each listener on ${method}`, () => {
        const listener1 = jasmine.createSpy('listener1');
        const listener2 = jasmine.createSpy('listener2');

        scope.$on('someEvent', listener1);
        scope.$on('someEvent', listener2);

        (<any>scope)[method]('someEvent');

        const event1 = listener1.calls.mostRecent().args[0];
        const event2 = listener2.calls.mostRecent().args[0];

        expect(event1).toBe(event2);
      });

      it(`passes additional arguments to listeners on ${method}`, () => {
        const listener = jasmine.createSpy('listener');

        scope.$on('someEvent', listener);

        (<any>scope)[method]('someEvent', 'and', ['additional', 'arguments'], '...');

        expect(listener.calls.mostRecent().args[1]).toEqual('and');
        expect(listener.calls.mostRecent().args[2]).toEqual(['additional', 'arguments']);
        expect(listener.calls.mostRecent().args[3]).toEqual('...');
      });

      it(`returns the event object on ${method}`, () => {
        const returnedEvent = (<any>scope)[method]('someEvent');

        expect(returnedEvent).toBeDefined();
        expect(returnedEvent.name).toBe('someEvent');
      });

      it(`can be deregistered for ${method}`, () => {
        const listener = jasmine.createSpy('listener');
        const deregisterFunction = scope.$on('someEvent', listener);

        deregisterFunction();

        (<any>scope)[method]('someEvent');

        expect(listener).not.toHaveBeenCalled();
      });

      it(`does not skip the next listener on ${method} when listener removed`, () => {
        let deregisterFunction: () => void;

        const listener = () => deregisterFunction();

        const nextListener = jasmine.createSpy('nextListener');

        deregisterFunction = scope.$on('someEvent', listener);

        scope.$on('someEvent', nextListener);

        (<any>scope)[method]('someEvent');

        expect(nextListener).toHaveBeenCalled();
      });

      it(`sets defaultPrevented when preventDefault is called on ${method}`, () => {
        const listener = (event: IEvent) => event.preventDefault();

        scope.$on('someEvent', listener);

        const event = (<any>scope)[method]('someEvent');

        expect(event.defaultPrevented).toBe(true);
      });

      it(`does not stop propagating when exceptions thrown in ${method}`, () => {
        const listener1 = jasmine.createSpy('listener1');
        const listener2 = (event: IEvent) => {
          throw 'listener2 throwing exception';
        };
        const listener3 = jasmine.createSpy('listener3');

        scope.$on('someEvent', listener1);
        scope.$on('someEvent', listener2);
        scope.$on('someEvent', listener3);

        (<any>scope)[method]('someEvent');

        expect(listener1).toHaveBeenCalled();
        expect(listener3).toHaveBeenCalled();
      });
    });

    it('propagates up the scope hierarchy on $emit', () => {
      const parentListener = jasmine.createSpy('parentListener');
      const scopeListener = jasmine.createSpy('scopeListener');

      parent.$on('someEvent', parentListener);
      scope.$on('someEvent', scopeListener);

      scope.$emit('someEvent');

      expect(scopeListener).toHaveBeenCalled();
      expect(parentListener).toHaveBeenCalled();
    });

    it('propagates the same event up on $emit', () => {
      const parentListener = jasmine.createSpy('parentListener');
      const scopeListener = jasmine.createSpy('scopeListener');

      parent.$on('someEvent', parentListener);
      scope.$on('someEvent', scopeListener);

      scope.$emit('someEvent');

      const scopeEvent = scopeListener.calls.mostRecent().args[0];
      const parentEvent = parentListener.calls.mostRecent().args[0];

      expect(scopeEvent).toBe(parentEvent);
    });

    it('propagates down the scope hierarchy on $broadcast', () => {
      const scopeListener = jasmine.createSpy('scopeListener');
      const childListener = jasmine.createSpy('childListener');
      const isolatedChildListener = jasmine.createSpy('isolatedChildListener');

      scope.$on('someEvent', scopeListener);
      child.$on('someEvent', childListener);
      isolatedChild.$on('someEvent', isolatedChildListener);

      scope.$broadcast('someEvent');

      expect(scopeListener).toHaveBeenCalled();
      expect(childListener).toHaveBeenCalled();
      expect(isolatedChildListener).toHaveBeenCalled();
    });

    it('propagates the same event down on $broadcast', () => {
      const scopeListener = jasmine.createSpy('scopeListener');
      const childListener = jasmine.createSpy('childListener');

      scope.$on('someEvent', scopeListener);
      child.$on('someEvent', childListener);

      scope.$broadcast('someEvent');

      const scopeEvent = scopeListener.calls.mostRecent().args[0];
      const childEvent = childListener.calls.mostRecent().args[0];

      expect(scopeEvent).toBe(childEvent);
    });

    it('attaches targetScpoe on $emit', () => {
      const scopeListener = jasmine.createSpy('scopeListener');
      const parentListener = jasmine.createSpy('parentListener');

      scope.$on('someEvent', scopeListener);
      parent.$on('someEvent', parentListener);

      scope.$emit('someEvent');

      expect(scopeListener.calls.mostRecent().args[0].targetScope).toBe(scope);
      expect(parentListener.calls.mostRecent().args[0].targetScope).toBe(scope);
    });

    it('attaches targetScpoe on $broadcast', () => {
      const scopeListener = jasmine.createSpy('scopeListener');
      const childListener = jasmine.createSpy('childListener');

      scope.$on('someEvent', scopeListener);
      child.$on('someEvent', childListener);

      scope.$broadcast('someEvent');

      expect(scopeListener.calls.mostRecent().args[0].targetScope).toBe(scope);
      expect(childListener.calls.mostRecent().args[0].targetScope).toBe(scope);
    });

    it('attaches currentScope on $emit', () => {
      let currentScopeInScopeListener: Scope;
      let currentScopeInParentListener: Scope;

      const scopeListener = (event: IEvent) => {
        currentScopeInScopeListener = event.currentScope;
      };

      const parentListener = (event: IEvent) => {
        currentScopeInParentListener = event.currentScope;
      };

      scope.$on('someEvent', scopeListener);
      parent.$on('someEvent', parentListener);

      scope.$emit('someEvent');

      expect(currentScopeInScopeListener).toBe(scope);
      expect(currentScopeInParentListener).toBe(parent);
    });

    it('attaches currentScope on $broadcast', () => {
      let currentScopeInScopeListener: Scope;
      let currentScopeInChildListener: Scope;

      const scopeListener = (event: IEvent) => {
        currentScopeInScopeListener = event.currentScope;
      };

      const childListener = (event: IEvent) => {
        currentScopeInChildListener = event.currentScope;
      };

      scope.$on('someEvent', scopeListener);
      child.$on('someEvent', childListener);

      scope.$broadcast('someEvent');

      expect(currentScopeInScopeListener).toBe(scope);
      expect(currentScopeInChildListener).toBe(child);
    });

    it('sets the current scope to null after propagation on $emit', () => {
      let event: IEvent;

      scope.$on('someEvent', (evt) => event = evt);

      scope.$emit('someEvent');

      expect(event.currentScope).toBe(null);
    });

    it('sets the current scope to null after propagation on $broadcast', () => {
      let event: IEvent;

      scope.$on('someEvent', (evt) => event = evt);

      scope.$broadcast('someEvent');

      expect(event.currentScope).toBe(null);
    });

    it('does not propagate to parents when stopped', () => {
      const scopeListener = (event: IEvent) => {
        event.stopPropagation();
      }

      const parentListener = jasmine.createSpy('parentListener');

      scope.$on('someEvent', scopeListener);
      parent.$on('someEvent', parentListener);

      scope.$emit('someEvent');

      expect(parentListener).not.toHaveBeenCalled();
    });

    it('is received by listeners on the current scope after being stopped', () => {
      const listener1 = jasmine.createSpy('listener1');

      const listener2 = (event: IEvent) => {
        event.stopPropagation();
      };

      const listener3 = jasmine.createSpy('listener3');

      scope.$on('someEvent', listener1);
      scope.$on('someEvent', listener2);
      scope.$on('someEvent', listener3);

      scope.$emit('someEvent');

      expect(listener1).toHaveBeenCalled();
      expect(listener3).toHaveBeenCalled();
    });
  });
});
