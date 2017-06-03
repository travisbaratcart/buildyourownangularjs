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
    const shoudlMatchPrimitives = _.isObject(expected) && ('$' in expected);

    return (element: any) => {
      if (shoudlMatchPrimitives && !_.isObject(element)) {
        return this.deepCompare(element, expected.$, this.contains, false);
      }

      return this.deepCompare(element, expected, this.contains, true);
    }
  }

  private deepCompare: (
    actual: any,
    expected: any,
    comparator: (element: any, expected: any) => boolean,
    shouldMatchAnyProperty: boolean) => boolean = (
    actual,
    expected,
    comparator,
    shouldMatchAnyProperty) => {

    if (_.isString(expected) && _.startsWith(expected, '!')) {
      return !this.deepCompare(
        actual,
        expected.substring(1),
        comparator,
        shouldMatchAnyProperty);
    }

    if (_.isArray(actual)) {
      return actual.some((element) => {
        return this.deepCompare(
          element,
          expected,
          comparator,
          shouldMatchAnyProperty);
      });
    }

    if (_.isObject(actual)) {
      if(_.isObject(expected)) {
        return _.every(expected, (expectedVal: any, expectedKey: string) => {
          if (expectedVal === undefined) {
            return true;
          }

          const isWildcard = expectedKey === '$';

          const actualComparisonValue = isWildcard ? actual : actual[expectedKey];

          return this.deepCompare(
            actualComparisonValue,
            expectedVal,
            comparator,
            isWildcard);
        });
      } else {
        if (shouldMatchAnyProperty) {
          return _.some(actual, value => this.deepCompare(
            value,
            expected,
            comparator,
            shouldMatchAnyProperty));
        } else {
          return comparator(actual, expected);
        }
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
