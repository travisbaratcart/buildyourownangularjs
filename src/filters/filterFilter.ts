'use strict';
import * as _ from 'lodash';

export class FilterFilter {
  // public getFilter(): (arr: any[], filter: any) => any[] {
  public getFilter = () => {
    return (arr: any[], filter: any): any[] => {
      let test: (element: any) => boolean;

      if (_.isFunction(filter)) {
        test = filter;
      } else if (
        _.isString(filter)
        || _.isNumber(filter)
        || _.isBoolean(filter)
        || _.isNull(filter)
        || _.isObject(filter)) {
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

    if (_.isString(expected) && _.startsWith(expected, '!')) {
      return !this.deepCompare(actual, expected.substring(1), comparator)
    }

    if (_.isArray(actual)) {
      return actual.some((element) => {
        return this.deepCompare(element, expected, comparator);
      });
    }

    if (_.isObject(actual)) {
      if(_.isObject(expected)) {
        return _.every(expected, (expectedVal, expectedKey) => {
          if (expectedVal === undefined) {
            return true;
          }

          return this.deepCompare(actual[expectedKey], expectedVal, comparator);
        });
      } else {
        return _.some(actual, value => this.deepCompare(value, expected, comparator));
      }
    }

    return comparator(actual, expected);
  };

  private contains = (element: any, expected: string) => {
    if (element === undefined) {
      return false;
    }

    if (element === null || expected === null) {
      return element === expected;
    }

    let elementString = ('' + element).toLowerCase();
    let expectedString = ('' + expected).toLowerCase();

    return elementString.indexOf(expectedString) > -1
  }
}
