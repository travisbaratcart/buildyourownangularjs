import * as _ from 'lodash';
import { FilterFilter } from './filters/filterFilter';

export interface IFilter {
  (...args: any[]): any;
  $stateful?: boolean;
}

export class FilterService {
  private filters: { [filterName: string]: IFilter } = {};

  private constructor() {
    this.register('filter', (new FilterFilter()).getFilter);
  }

  private static filterService: FilterService;

  public static getInstance(): FilterService {
    if (!FilterService.filterService) {
      FilterService.filterService = new FilterService();
    }

    return FilterService.filterService;
  }

  public register(
    filterNameOrObject: string | { [filterName: string]: () => IFilter },
    factory?: () => IFilter,
    options?: { $stateful?: boolean }): IFilter[] {
    if (_.isObject(filterNameOrObject)) {
      const filterObject = <{ [filterName: string]: IFilter }>filterNameOrObject;

      return _.map(filterObject, (factory, filterName) => {
        return this.register(filterName, factory, options)[0];
      });
    }

    const filterName = <string>filterNameOrObject;
    const filter = factory();

    if (options) {
      filter.$stateful = options.$stateful;
    }

    this.filters[filterName] = filter;
    return [filter];
  }

  public filter(filterName: string): IFilter {
    return this.filters[filterName];
  }
}
