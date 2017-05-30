'use strict';
import * as _ from 'lodash';

export class FilterFilter {
  // public getFilter(): (arr: any[], filter: any) => any[] {
  public getFilter = () => {
    return (arr: any[], filter: any): any[] => {
      let test: (element: any) => boolean;

      if (_.isFunction(filter)) {
        test = filter;
      } else if (_.isString(filter)) {
        test = this.createTest(filter);
      } else {
        return arr;
      }

      return arr.filter(test);
    }
  }

  private createTest = (str: string) => {
    return (element: any) => this.deepCompare(element, str, this.contains);
  }

  private deepCompare = (
    actual: any,
    expected: string,
    comparator: (element: any, str: string) => boolean) => {

    if (_.isObject(actual)) {
      return _.some(actual, value => this.deepCompare(value, expected, comparator));
    } else {
      return comparator(actual, expected);
    }
  };

  private contains = (element: any, str: string) => {
    return element.toLowerCase().indexOf(str.toLowerCase()) > -1
  }
}
