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
  }];

  public defaults = defaultConfig;
}

const defaultConfig: any = {
  headers: {
    common: {
      Accept: 'application/json, text/plain, */*'
    },
    post: {
      'Content-Type': 'application/json;charset=utf-8'
    },
    put: {
      'Content-Type': 'application/json;charset=utf-8'
    },
    patch: {
      'Content-Type': 'application/json;charset=utf-8'
    }
  }
};

interface IHttpRequestConfig {
  url: string;
  method?: string;
  data?: any
  headers?: { [ headerName: string ]: string};
}

interface IHttpResponse {
  status: number;
  data: any;
  statusText: string;
  config: IHttpRequestConfig;
}

export class $HttpService {
  constructor(
    private $httpBackend: $HttpBackendService,
    private $q: $QService,
    private $rootScope: Scope) {

  }

  public defaults = defaultConfig;

  public request(config: IHttpRequestConfig): Promise {
    this.setConfigDefaultsIfNecessary(config);

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

  private setConfigDefaultsIfNecessary(config: IHttpRequestConfig) {
    if (!config.method) {
      config.method = 'GET';
    }

    this.setDefaultHeadersIfNecessary(config);
  }

  private setDefaultHeadersIfNecessary(config: IHttpRequestConfig) {
    const commonDefaultHeaders = this.defaults.headers.common;

    const methodSpecificDefaultHeaders
      = this.defaults.headers[config.method.toLowerCase()] || {};

    config.headers = _.extend(
      {},
      commonDefaultHeaders,
      methodSpecificDefaultHeaders,
      config.headers);
  }

  private isSuccess(statusCode: number) {
    return 200 <= statusCode && statusCode < 300;
  }
}
