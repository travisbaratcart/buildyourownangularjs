import * as _ from 'lodash';

interface IWatcher {
  watchFunction: (scope: Scope) => any,
  listenerFunction?: (newValue: any, oldValue: any, scope: Scope) => any,
  lastWatchValue: any,
  checkValueEquality: boolean
};

const initialWatchValue = (): any => null;

export class Scope {
  private $$watchers: IWatcher[] = [];
  private $$lastDirtyWatch: IWatcher = null; // Optimization to avoid cycling all watches when unnecessary

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

    let isDirty = false;
    this.$$lastDirtyWatch = null;
    let numberOfChainedDigestCycles = 0;

    do {
      isDirty = this.$$digestOnce();

      numberOfChainedDigestCycles++;

      if (isDirty && numberOfChainedDigestCycles == maxChainedDigestCycles) {
        throw '10 digest iterations reached';
      }

    } while (isDirty);
  }

  private $$digestOnce(): boolean {
    let newValue: any, oldValue: any;

    let isDirty = false;

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

        isDirty = true;
      } else if (this.$$lastDirtyWatch === watcher) {
        return false;
      }
    });

    return isDirty;
  }

  private $$areEqual(
    newValue: any,
    oldValue: any,
    checkValueEquality: boolean): boolean {
    return checkValueEquality
      ? _.isEqual(newValue, oldValue)
      : newValue === oldValue;
  }
}






