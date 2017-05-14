import * as _ from 'lodash';

interface IWatcher {
  watchFunction: (scope: Scope) => any,
  listenerFunction?: (newValue: any, oldValue: any, scope: Scope) => any,
  last: any
};

const initialWatchValue = (): any => null;

export class Scope {
  private $$watchers: IWatcher[] = [];

  /* Not putting these on prototype until typescript makes it reasonable to do so */
  public $watch(
    watchFunction: (scope: Scope) => any,
    listenerFunction?: (newValue: any, oldValue: any, scope: Scope) => any): void {

    const watcher: IWatcher = {
      watchFunction: watchFunction,
      listenerFunction: listenerFunction,
      last: initialWatchValue
    };

    this.$$watchers.push(watcher);
  }

  public $digest() {
    let isDirty = false;

    do {
      isDirty = this.$$digestOnce();
    } while (isDirty);
  }

  private $$digestOnce(): boolean {
    let newValue: any, oldValue: any;

    let isDirty = false;

    _.forEach(this.$$watchers, (watcher) => {
      newValue = watcher.watchFunction(this);
      oldValue = watcher.last;

      if (oldValue !== newValue) {
        watcher.last = newValue;

        if (watcher.listenerFunction) {
          watcher.listenerFunction(
            newValue,
            oldValue === initialWatchValue ? newValue : oldValue,
            this);
        }

        isDirty = true;
      }
    });

    return isDirty;
  }
}






