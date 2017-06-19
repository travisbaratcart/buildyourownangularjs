'use strict';
import * as _ from 'lodash';

export function hashKey(item: any): string {
  const type = typeof item;

  const isObjectOrFunction = type === 'function' || type === 'object' && item !== null;

  if (!isObjectOrFunction) {
    return `${type}:${item}`;
  } else {
    const uid = item.$$hashKey || _.uniqueId();

    item.$$hashKey = uid;

    return `${type}:${uid}`;
  }
}
