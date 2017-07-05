'use strict';
import { IProvider } from './injector';
import { $HttpBackendService } from './httpBackend';
import { $QService, Promise } from './q';
import { Scope } from './scope';
import * as _ from 'lodash';

export class $HttpProvider {
  public $get = ['$httpBackend', '$q', '$rootScope', function(
    $httpBackend: $HttpBackendService,
    $q: $QService,
    $rootScope: Scope) {

    return new $HttpService($httpBackend, $q, $rootScope);
  }]
}

interface IHttpRequestConfig {
  url: string;
  method?: string;
  data?: any
}

interface IHttpResponse {
  status: number;
  data: any;
  statusText: string;
  config: IHttpRequestConfig;
  headers?: { [ headerName: string ]: string};
}

export class $HttpService {
  constructor(
    private $httpBackend: $HttpBackendService,
    private $q: $QService,
    private $rootScope: Scope) {

  }

  private defaultConfig: IHttpRequestConfig = {
    method: 'GET',
    url: ''
  };

  public request(rawConfig: IHttpRequestConfig): Promise {
    const config = _.extend(this.defaultConfig, rawConfig);

    const deferred = this.$q.defer();

    const onDone = (statusCode: number, response: any, statusText: string) => {
      const httpResponse: IHttpResponse = {
        status: Math.max(statusCode, 0),
        data: response,
        statusText,
        config
      }

      this.isSuccess(statusCode)
        ? deferred.resolve(httpResponse)
        : deferred.reject(httpResponse);

      if (!this.$rootScope.$$phase) {
        this.$rootScope.$apply();
      }
    }

    this.$httpBackend.request(config.method, config.url, config.data, onDone, config.headers);

    return deferred.promise;
  }

  private isSuccess(statusCode: number) {
    return 200 <= statusCode && statusCode < 300;
  }
}
