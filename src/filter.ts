import * as _ from 'lodash';
import { FilterFilter } from './filters/filterFilter';
import { IProvider, IProvide, Injector } from './injector';

export interface IFilter {
  (...args: any[]): any;
  $stateful?: boolean;
}

export interface IFilterService {
  (filterName: string): IFilter
};

export class $FilterProvider implements IProvider {
  $inject = ['$provide'];

  private constructor(private $provide: IProvide) {
    this.register('filter', (new FilterFilter()).getFilter);
  }

  public register(
    filterNameOrObject: string | { [filterName: string]: () => IFilter },
    factory?: (...args: any[]) => IFilter): void {
    if (_.isObject(filterNameOrObject)) {
      const filterObject = <{ [filterName: string]: IFilter }>filterNameOrObject;

      _.forEach(filterObject, (factory, filterName) => {
        this.register(filterName, factory);
      });
    }

    const filterName = <string>filterNameOrObject;

    this.$provide.factory(`${filterName}Filter`, factory);
  }

  public $get = ['$injector', function($injector: Injector) {
    return function (filterName: string) {
      return $injector.get(`${filterName}Filter`);
    }
  }]
}
