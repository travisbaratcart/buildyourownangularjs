'use strict';
import * as _ from 'lodash';

export class FilterFilter {
  // public getFilter(): (arr: any[], filter: any) => any[] {
  public getFilter = () => {
    return (arr: any[], filter: any): any[] => {
      let test: (element: any) => boolean;

      if (_.isFunction(filter)) {
        test = filter;
      } else if (_.isString(filter) || _.isNumber(filter) || _.isBoolean(filter)) {
        test = this.createTest(filter);
      } else {
        return arr;
      }

      return arr.filter(test);
    }
  }

  private createTest = (expected: any) => {
    return (element: any) => this.deepCompare(element, expected, this.contains);
  }

  private deepCompare: (
    actual: any,
    expected: any,
    comparator: (element: any, expected: any) => boolean) => boolean = (
    actual,
    expected,
    comparator) => {
    if (_.isObject(actual)) {
      return _.some(actual, value => this.deepCompare(value, expected, comparator));
    } else {
      return comparator(actual, expected);
    }
  };

  private contains = (element: any, expected: string) => {
    let elementString = ('' + element).toLowerCase();
    let expectedString = ('' + expected).toLowerCase();

    return elementString.indexOf(expectedString) > -1
  }
}
