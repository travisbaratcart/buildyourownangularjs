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
  private $$watchers: IWatcher[] = [];
  private $$lastDirtyWatch: IWatcher = null; // Optimization to avoid cycling all watches when unnecessary
  private $$asyncQueue: IAsyncQueueItem[] = [];

  private isDirty = false;

  /* Not putting these on prototype until typescript makes it reasonable to do so */
  public $watch(
    watchFunction: (scope: Scope) => any,
    listenerFunction?: (newValue: any, oldValue: any, scope: Scope) => any,
    checkValueEquality: boolean = false): void {

    /* Watchers can add other watchers. Avoid optimizations when adding new watchers */
    this.$$lastDirtyWatch = null;

    const watcher: IWatcher = {
      watchFunction: watchFunction,
      listenerFunction: listenerFunction,
      lastWatchValue: initialWatchValue,
      checkValueEquality: checkValueEquality
    };

    this.$$watchers.push(watcher);
  }

  public $digest() {
    const maxChainedDigestCycles = 10;

    this.isDirty = false;
    this.$$lastDirtyWatch = null;

    let numberOfChainedDigestCycles = 0;

    do {
      while (this.$$asyncQueue.length) {
        const asyncTask = this.$$asyncQueue.shift();
        asyncTask.scope.$eval(asyncTask.functionToEvaluate);
      }

      this.$$digestOnce();

      numberOfChainedDigestCycles++;

      if (this.shouldTriggerChainedDigestCycle() && numberOfChainedDigestCycles === maxChainedDigestCycles) {
        throw '10 digest iterations reached';
      }

    } while (this.shouldTriggerChainedDigestCycle());
  }

  public $eval(
    evalFunction: (scope: Scope, passThroughArg?: any) => any,
    passThroughArg?: any): any {

    return evalFunction(this, passThroughArg);
  }

  public $apply(applyFunction: (scope: Scope) => void) {
    try {
      this.$eval(applyFunction);
    } finally {
      this.$digest();
    }
  }

  public $evalAsync(functionToEvaluate: (scope: Scope) => void) {
    let newAsyncQueueItem: IAsyncQueueItem = {
      functionToEvaluate,
      scope: this
    };

    this.$$asyncQueue.push(newAsyncQueueItem);
  }

  private $$digestOnce(): void {
    let newValue: any, oldValue: any;

    this.isDirty = false;

    _.forEach(this.$$watchers, (watcher) => {
      newValue = watcher.watchFunction(this);
      oldValue = watcher.lastWatchValue;

      if (!this.$$areEqual(newValue, oldValue, watcher.checkValueEquality)) {
        this.$$lastDirtyWatch = watcher;

        watcher.lastWatchValue = watcher.checkValueEquality
          ? _.cloneDeep(newValue)
          : newValue;

        if (watcher.listenerFunction) {
          watcher.listenerFunction(
            newValue,
            oldValue === initialWatchValue ? newValue : oldValue,
            this);
        }

        this.isDirty = true;
      } else if (this.$$lastDirtyWatch === watcher) {
        // Performance optimization: If we reach the last dirty watch, we've
        // gone a full cycle and can therefore stop here.
        this.isDirty = false;
        return false;
      }
    });
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
}






