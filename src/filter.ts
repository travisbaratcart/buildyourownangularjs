import * as _ from 'lodash';

export class FilterService {
  private filters: { [filterName: string]: () => any } = {};

  public register(filterNameOrObject: string | { [filterName: string]: () => () => any }, factory?: () => () => any): (() => any)[] {
    if (_.isObject(filterNameOrObject)) {
      const filterObject = <{ [filterName: string]: () => () => any }>filterNameOrObject;

      return _.map(filterObject, (factory, filterName) => {
        return this.register(filterName, factory)[0];
      });
    }

    const filterName = <string>filterNameOrObject;
    const filter = factory();
    this.filters[filterName] = filter;
    return [filter];
  }

  public filter(filterName: string): () => any {
    return this.filters[filterName];
  }
}
