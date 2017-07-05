'use strict';
import { IProvider } from './injector';
import { $HttpBackendService } from './httpBackend';
import { $QService, Promise } from './q';

export class $HttpProvider {
  public $get = ['$httpBackend', '$q', function(
    $httpBackend: $HttpBackendService,
    $q: $QService) {

    return new $HttpService($httpBackend, $q);
  }]
}

interface IHttpRequestConfig {
  url: string;
  method?: string;
  data?: any
}

export class $HttpService {
  constructor(
    private $httpBackend: $HttpBackendService,
    private $q: $QService) {

  }

  public request(config: IHttpRequestConfig): Promise {
    const deferred = this.$q.defer();

    this.$httpBackend.request(config.method, config.url, config.data);

    return deferred.promise;
  }
}
