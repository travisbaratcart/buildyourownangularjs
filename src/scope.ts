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

  private $$asyncQueue: IAsyncQueueItem[] = [];

  private $$applyAsyncQueue: (() => any)[] = [];
  private $$applyAsyncDigestMarker: number = null;

  private $$postDigestQueue: (() => void)[] = [];

  private isDirty = false;

  /* Not putting these on prototype until typescript makes it reasonable to do so */
  public $watch(
    watchFunction: (scope: Scope) => any,
    listenerFunction?: (newValue: any, oldValue: any, scope: Scope) => any,
    checkValueEquality: boolean = false): () => void {

    /* Watchers can add other watchers. Avoid optimizations when adding new watchers */
    this.$$lastDirtyWatch = null;

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
        this.$$lastDirtyWatch = null;
      }
    }
  }

  public $digest() {
    const maxChainedDigestCycles = 10;

    this.$beginPhase('$digest')

    this.isDirty = false;
    this.$$lastDirtyWatch = null;

    let numberOfChainedDigestCycles = 0;

    if (this.$$applyAsyncDigestMarker) {
      clearTimeout(this.$$applyAsyncDigestMarker);
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

      this.$$digestOnce();

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
      this.$digest();
    }
  }

  public $evalAsync(functionToEvaluate: (scope: Scope) => void) {
    if (!this.$$phase && !this.$$asyncQueue.length) {
      // If the queue item added below isn't picked up by another digest cycle,
      // this will set another digest cycle on the next js turn.
      setTimeout(() => {
        if (this.$$asyncQueue.length) {
          this.$digest();
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
    if (this.$$applyAsyncDigestMarker === null) {
      this.$$applyAsyncDigestMarker = setTimeout(() => {
        this.$apply(() => this.$$flushApplyAsync());
      });
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

    this.$$applyAsyncDigestMarker = null;
  }

  private $$digestOnce(): void {
    let newValue: any, oldValue: any;

    this.isDirty = false;

    _.forEachRight(this.$$watchers, (watcher) => {
      try {
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
      } catch (error) {
        console.error(error);
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

  private $beginPhase(phase: string) {
    if (this.$$phase) {
      throw `${this.$$phase} already in progress`;
    }

    this.$$phase = phase;
  }

  private $clearPhase() {
    this.$$phase = null;
  }
}






