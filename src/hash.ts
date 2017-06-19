'use strict';
import * as _ from 'lodash';

export function hashKey(item: any): string {
  const type = typeof item;

  const isObjectOrFunction = type === 'function' || type === 'object' && item !== null;

  if (!isObjectOrFunction) {
    return `${type}:${item}`;
  } else {
    let uid: string;

    if (typeof item.$$hashKey === 'function') {
      uid = item.$$hashKey();
    } else if (item.$$hashKey) {
      uid = item.$$hashKey;
    } else {
      uid = _.uniqueId();
    }

    item.$$hashKey = uid;

    return `${type}:${uid}`;
  }
}
