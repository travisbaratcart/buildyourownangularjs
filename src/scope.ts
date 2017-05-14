import * as _ from 'lodash';

interface IWatcher {
  watchFunction: (scope: Scope) => any,
  listenerFunction: (newValue: any, oldValue: any, scope: Scope) => any,
  last?: any
};

export class Scope {
  private $$watchers: IWatcher[] = [];

  /* Not putting these on prototype until typescript makes it reasonable to do so */
  public $watch(
    watchFunction: (scope: Scope) => any,
    listenerFunction: (newValue: any, oldValue: any, scope: Scope) => any): void {

    const watcher: IWatcher = {
      watchFunction: watchFunction,
      listenerFunction: listenerFunction
    };

    this.$$watchers.push(watcher);
  }

  public $digest() {
    let newValue: any, oldValue: any;

    _.forEach(this.$$watchers, (watcher) => {
      newValue = watcher.watchFunction(this);
      oldValue = watcher.last;

      if (oldValue !== newValue) {
        watcher.last = newValue;
        watcher.listenerFunction(newValue, oldValue, this);
      }

    });
  }
}
