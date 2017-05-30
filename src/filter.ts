import * as _ from 'lodash';

export class FilterService {
  private filters: { [filterName: string]: (obj: any) => any } = {};

  private static filterService: FilterService;

  public static getInstance(): FilterService {
    if (!FilterService.filterService) {
      FilterService.filterService = new FilterService();
    }

    return FilterService.filterService;
  }

  public register(filterNameOrObject: string | { [filterName: string]: () => (obj: any) => any }, factory?: () => (obj: any) => any): ((obj: any) => any)[] {
    if (_.isObject(filterNameOrObject)) {
      const filterObject = <{ [filterName: string]: () => (obj: any) => any }>filterNameOrObject;

      return _.map(filterObject, (factory, filterName) => {
        return this.register(filterName, factory)[0];
      });
    }

    const filterName = <string>filterNameOrObject;
    const filter = factory();
    this.filters[filterName] = filter;
    return [filter];
  }

  public filter(filterName: string): (obj: any) => any {
    return this.filters[filterName];
  }
}
