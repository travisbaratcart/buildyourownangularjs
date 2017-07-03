'use strict';
import { publishExternalAPI } from '../src/angularPublic';
import { createInjector } from '../src/injector';
import { $QService } from '../src/q';

describe('q', () => {
  let $q: $QService;

  beforeEach(() => {
    publishExternalAPI();
    $q = createInjector(['ng']).get('$q');
  });

  it('can create a deferred', () => {
    const deferred = $q.defer();

    expect(deferred).toBeDefined();
  });
});
