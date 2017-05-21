import * as _ from 'lodash';

interface IWatcher {
  watchFunction: (scope: Scope) => any,
  listenerFunction?: (newValue: any, oldValue: any, scope: Scope) => any,
  lastWatchValue: any,
  checkValueEquality: boolean
};

interface IAsyncQueueItem {
  functionToEvaluate: (scope: Scope) => void;
  scope: Scope;
}

const initialWatchValue = (): any => null;

export class Scope {
  // as the name implies not supposed to be public in angular, but we need it public for test
  public $$phase: string;

  private $$watchers: IWatcher[] = [];
  private $$lastDirtyWatch: IWatcher = null; // Optimization to avoid cycling all watches when unnecessary

  private $$asyncQueue: IAsyncQueueItem[];

  private $$applyAsyncQueue: (() => any)[];
  private $$applyAsyncDigestMarker: number = null;

  private $$postDigestQueue: (() => void)[] = [];

  private isDirty = false;

  private $root: Scope;
  private $parent: Scope;
  public $$children: Scope[] = [];

  constructor($parent?: Scope, $root?: Scope) {
    this.$root = $root || this;
    this.$parent = $parent || null;

    this.$$asyncQueue = $root
      ? $root.$$asyncQueue
      : [];

    this.$$applyAsyncQueue = $root
      ? $root.$$applyAsyncQueue
      : [];
  }

  /* Not putting these on prototype until typescript makes it reasonable to do so */
  public $watch(
    watchFunction: (scope: Scope) => any,
    listenerFunction?: (newValue: any, oldValue: any, scope: Scope) => any,
    checkValueEquality: boolean = false): () => void {

    /* Watchers can add other watchers. Avoid optimizations when adding new watchers */
    this.$root.$$lastDirtyWatch = null;

    const watcher: IWatcher = {
      watchFunction: watchFunction,
      listenerFunction: listenerFunction,
      lastWatchValue: initialWatchValue,
      checkValueEquality: checkValueEquality
    };

    this.$$watchers.unshift(watcher);

    return () => {
      const watcherIndex = this.$$watchers.indexOf(watcher);

      if (watcherIndex >= 0) {
        this.$$watchers.splice(watcherIndex, 1);
        this.$root.$$lastDirtyWatch = null;
      }
    }
  }

  public $digest() {
    const maxChainedDigestCycles = 10;

    this.$beginPhase('$digest')

    this.isDirty = false;
    this.$root.$$lastDirtyWatch = null;

    let numberOfChainedDigestCycles = 0;

    if (this.getApplyAsyncDigestMarker()) {
      clearTimeout(this.getApplyAsyncDigestMarker());
      this.$$flushApplyAsync();
    }

    do {
      while (this.$$asyncQueue.length) {
        try {
          const asyncTask = this.$$asyncQueue.shift();
          asyncTask.scope.$eval(asyncTask.functionToEvaluate);
        } catch (error) {
          console.error(error);
        }
      }

      this.$$digestFullScopeOnce();

      numberOfChainedDigestCycles++;

      if (this.shouldTriggerChainedDigestCycle() && numberOfChainedDigestCycles === maxChainedDigestCycles) {
        this.$clearPhase();
        throw '10 digest iterations reached';
      }

    } while (this.shouldTriggerChainedDigestCycle());

    this.$clearPhase();

    while (this.$$postDigestQueue.length) {
      try {
        this.$$postDigestQueue.shift()();
      } catch (error) {
        console.error(error);
      }
    }
  }

  public $eval(
    evalFunction: (scope: Scope, passThroughArg?: any) => any,
    passThroughArg?: any): any {

    return evalFunction(this, passThroughArg);
  }

  public $apply(applyFunction: (scope: Scope) => void) {
    this.$beginPhase('$apply');

    try {
      this.$eval(applyFunction);
    } finally {
      this.$clearPhase();
      this.$root.$digest();
    }
  }

  public $evalAsync(functionToEvaluate: (scope: Scope) => void) {
    if (!this.$$phase && !this.$$asyncQueue.length) {
      // If the queue item added below isn't picked up by another digest cycle,
      // this will set another digest cycle on the next js turn.
      setTimeout(() => {
        if (this.$$asyncQueue.length) {
          this.$root.$digest();
        }
      }, 0);
    }

    let newAsyncQueueItem: IAsyncQueueItem = {
      functionToEvaluate,
      scope: this
    };

    this.$$asyncQueue.push(newAsyncQueueItem);
  }

  public $applyAsync(functionToEvaluate: (scope: Scope) => void) {
    this.$$applyAsyncQueue.push(() => this.$eval(functionToEvaluate));

    // Ensure functions executed on next turn.
    if (this.getApplyAsyncDigestMarker() === null) {
      const newApplyAsyncDigestMarker = setTimeout(() => {
        this.$apply(() => this.$$flushApplyAsync());
      });

      this.setApplyAsyncDigestMarker(newApplyAsyncDigestMarker);
    }
  }

  // intended private in angular, but we need public to test
  public $$postDigest(functionToEvaluate: () => void) {
    this.$$postDigestQueue.push(functionToEvaluate);
  }

  private $$flushApplyAsync(): void {
    while (this.$$applyAsyncQueue.length) {
      try {
        this.$$applyAsyncQueue.shift()();
      } catch (error) {
        console.error(error);
      }
    }

    this.setApplyAsyncDigestMarker(null);
  }

  public $watchGroup(
    watchFunctions: ((scope: Scope) => any)[],
    listenerFunction?: (newValue: any, oldValue: any, scope: Scope) => any): () => void {

    const newValues = new Array(watchFunctions.length);
    const oldValues = new Array(watchFunctions.length);

    let changeReactionScheduled = false;

    let isFirstRun = true;

    if (watchFunctions.length === 0) {
      let shouldCall = true;
      this.$evalAsync(() => {
        if (shouldCall) {
          listenerFunction(newValues, oldValues, this);
        }
      });

      return () => shouldCall = false;
    }

    const watchGroupListener = () => {
      if (isFirstRun) {
        isFirstRun = false;
        listenerFunction(newValues, newValues, this);
      } else {
        listenerFunction(newValues, oldValues, this);
      }

      changeReactionScheduled = false;
    }

    const destroyFunctions =  _.map(watchFunctions, (watchFunction, i) => {
      return this.$watch(watchFunction, (newValue, oldValue) => {
        newValues[i] = newValue;
        oldValues[i] = oldValue;
        if (!changeReactionScheduled) {
          changeReactionScheduled = true;
          this.$evalAsync(watchGroupListener);
        }
      });
    });

    return () => {
      _.forEach(destroyFunctions, (destroyFunction) => {
        destroyFunction();
      });
    }
  }

  public $new(isIsolateScope = false, parent = this): Scope {
    class ChildScope extends Scope {
    }

    ChildScope.prototype = this;

    const child: Scope = isIsolateScope
      ? new Scope(parent, parent.$root)
      : new ChildScope(parent, parent.$root);

    parent.$$children.push(child);

    return child;
  }

  public $destroy(): void {
    this.removeScopeFromParentChildren();
    this.$$watchers = null;
  }

  public $watchCollection(
    watchFunction: (scope: Scope) => any,
    listenerFunction?: (newValue: any, oldValue: any, scope: Scope) => any): () => void {

    // Performance optimization: Only worry about maintaining deep copies of old value
    // if actually needed for listener.
    const listenerNeedsOldValue = listenerFunction.length > 1;

    let newValue: any;

    let oldValueInternal: any; // modified internally during comparison - unreliable for listener
    let oldValueActual: any // actual clone of old value - only tracked if required

    let changeCount = 0;

    let isFirstRun = true;

    const internalWatchFunction = (scope: Scope) => {
      newValue = watchFunction(scope);
      if (_.isObject(newValue)) {
        if (_.isArrayLikeObject(newValue)) {
          if (!_.isArray(oldValueInternal)) {
            changeCount++;
            oldValueInternal = [];
          }

          if (newValue.length !== oldValueInternal.length) {
            changeCount++;
            oldValueInternal.length = newValue.length;
          }

          _.forEach(newValue, (newItem, i) => {
            if (!this.$$areEqual(newItem, oldValueInternal[i], false)) {
              changeCount++;
              oldValueInternal[i] = newItem;
            }
          })
        } else {
          // Object case
          if (!_.isObject(oldValueInternal) || _.isArrayLike(oldValueInternal)) {
            changeCount++;
            oldValueInternal = {};
          }

          let keyAdded = false;
          _.forOwn(newValue, (newValueField, key) => {
            if(!this.$$areEqual(oldValueInternal[key], newValueField, false) {
              changeCount++;

              if (!oldValueInternal.hasOwnProperty(key)) {
                keyAdded = true;
              }

              oldValueInternal[key] = newValueField;
            }
          });

          // Performance optimization: Only check deleted properties if lengths different
          // or if some property is added and the lengths are the same - implying another
          // must have been deleted.
          if ((Object.keys(oldValueInternal).length !== Object.keys(newValue).length)
            || keyAdded) {
            _.forOwn(oldValueInternal, (oldValueField, key) => {
              if (!newValue.hasOwnProperty(key)) {
                changeCount++;
                delete oldValueInternal[key];
              }
            });
          }
        }
      } else {
        // Trivial Case
        if (!this.$$areEqual(newValue,  oldValueInternal, false)) {
          changeCount++;
        }

        oldValueInternal = newValue;
      }

      return changeCount;
    };

    const internalListenerFunction = () => {
      if (isFirstRun) {
        listenerFunction(newValue, newValue, this);
        isFirstRun = false
      } else {
        listenerFunction(newValue, oldValueActual, this);
      }

      if (listenerNeedsOldValue) {
        oldValueActual = _.clone(newValue);
      }
    };

    return this.$watch(internalWatchFunction, internalListenerFunction);
  }

  private removeScopeFromParentChildren(): void {
    if (this.$parent) {
      const siblings = this.$parent.$$children;
      const indexOfThisScope = siblings.indexOf(this);

      if (indexOfThisScope > -1) {
        siblings.splice(indexOfThisScope, 1);
      }
    }
  }

  private $$digestFullScopeOnce(): void {
    const isEveryScopeClean = this.$$everyScope((scope: Scope) => {
      return !this.$$digestScopeLevelOnce(scope);
    });

    this.isDirty = !isEveryScopeClean;
  }

  private $$digestScopeLevelOnce(scope: Scope): boolean {
    let isScopeDirty = false

    _.forEachRight(scope.$$watchers, (watcher) => {
      try {
        if (watcher) {
          let newValue = watcher.watchFunction(scope);
          let oldValue = watcher.lastWatchValue;

          if (!this.$$areEqual(newValue, oldValue, watcher.checkValueEquality)) {
            scope.$root.$$lastDirtyWatch = watcher;

            watcher.lastWatchValue = watcher.checkValueEquality
            ? _.cloneDeep(newValue)
            : newValue;

            if (watcher.listenerFunction) {
              watcher.listenerFunction(
                newValue,
                oldValue === initialWatchValue ? newValue : oldValue,
                scope);
            }

            isScopeDirty = true;
          } else if (scope.$root.$$lastDirtyWatch === watcher) {
            // Performance optimization: If we reach the last dirty watch, we've
            // gone a full cycle and can therefore stop here.
            isScopeDirty = false;
            return false;
          }
        }
      } catch (error) {
        console.error(error);
      }
    });

    return isScopeDirty;
  }

  private $$everyScope(test: (scope: Scope) => boolean): boolean {
    if (test(this)) {
      return this.$$children.every(child => child.$$everyScope(test));
    } else {
      return false;
    }
  }

  private  shouldTriggerChainedDigestCycle(): boolean {
    return this.isDirty || this.$$asyncQueue.length > 0;
  }

  private $$areEqual(
    newValue: any,
    oldValue: any,
    checkValueEquality: boolean): boolean {

    // NaN is not === to NaN in javascript. But for our cases is it.
    if (
      typeof newValue === 'number'
      && typeof oldValue === 'number'
      && isNaN(newValue)
      && isNaN(oldValue)) {
      return true;
    }

    return checkValueEquality
      ? _.isEqual(newValue, oldValue)
      : newValue === oldValue;
  }

  private $beginPhase(phase: string) {
    if (this.$$phase) {
      throw `${this.$$phase} already in progress`;
    }

    this.$$phase = phase;
  }

  private $clearPhase() {
    this.$$phase = null;
  }

  private getApplyAsyncDigestMarker(): number {
    return this.$root.$$applyAsyncDigestMarker;
  }

  private setApplyAsyncDigestMarker(newDigestMarker: number): void {
    this.$root.$$applyAsyncDigestMarker = newDigestMarker;
  }
}






