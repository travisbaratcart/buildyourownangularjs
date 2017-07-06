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

interface IHeaderObject {
  [ headerName: string ]: string
}

export interface IHttpRequestConfig {
  url: string;
  method?: string;
  data?: any
  headers?: { [ headerName: string ]: string};
  withCredentials?: boolean
}

interface IHttpResponse {
  status: number;
  data: any;
  statusText: string;
  headers: (headerName: string) => string | IHeaderObject;
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

    const onDone = (statusCode: number, response: any, headers: string, statusText: string) => {
      const httpResponse: IHttpResponse = {
        status: Math.max(statusCode, 0),
        data: response,
        statusText,
        headers: this.getHeaderGetter(headers),
        config
      }

      this.isSuccess(statusCode)
        ? deferred.resolve(httpResponse)
        : deferred.reject(httpResponse);

      if (!this.$rootScope.$$phase) {
        this.$rootScope.$apply();
      }
    }

    this.$httpBackend.request(
      config.method,
      config.url,
      config.data,
      onDone,
      config.headers,
      config.withCredentials);

    return deferred.promise;
  }

  private setConfigDefaultsIfNecessary(config: IHttpRequestConfig) {
    if (!config.method) {
      config.method = 'GET';
    }

    if (config.withCredentials === undefined
      && this.defaults.withCredentials !== undefined) {
      config.withCredentials = this.defaults.withCredentials;
    }

    this.setDefaultHeadersIfNecessary(config);
  }

  private setDefaultHeadersIfNecessary(config: IHttpRequestConfig) {
    if (!config.headers) {
      config.headers = {};
    }

    const commonDefaultHeaders = this.defaults.headers.common;

    const methodSpecificDefaultHeaders
      = this.defaults.headers[config.method.toLowerCase()] || {};

    const defaultHeaders = _.extend(commonDefaultHeaders, methodSpecificDefaultHeaders);

    _.forEach(defaultHeaders, (defaultHeaderValue, defaultHeaderName) => {
      const headerAlreadySet = _.some(config.headers, (value, configHeaderName) => {
        return defaultHeaderName.toLowerCase() === configHeaderName.toLowerCase();
      });

      if (!headerAlreadySet) {
        const headerValue = typeof defaultHeaderValue === 'function'
          ? defaultHeaderValue(config)
          : defaultHeaderValue;

        if (headerValue !== null && headerValue !== undefined) {
          config.headers[defaultHeaderName] = headerValue;
        }
      }
    });

    this.removeContentTypeIfNecessary(config);
  }

  private removeContentTypeIfNecessary(config: IHttpRequestConfig) {
    if (config.data === undefined) {
      _.forEach(config.headers, (value, headerName) => {
        if (headerName.toLowerCase() === 'content-type') {
          delete config.headers[headerName];
        }
      });
    }
  }

  private isSuccess(statusCode: number) {
    return 200 <= statusCode && statusCode < 300;
  }

  private getHeaderGetter(
    headersString: string): (headerName: string) => string | IHeaderObject {
    let headers: { [ headerName: string ]: string };

    return (headerName: string) => {
      headers = headers || this.parseHeaders(headersString);

      return headerName
        ? headers[headerName.toLowerCase()]
        : headers;
    }
  }

  private parseHeaders(headersString: string): { [ headerName: string ]: string} {
    const headerLines = headersString.split('\n');

    return <{ [ headerName: string ]: string}>_.transform(headerLines, (result, line) => {
      const separatorIndex = line.indexOf(':');
      const headerName = _.trim(line.substr(0, separatorIndex)).toLowerCase();
      const headerValue = _.trim(line.substr(separatorIndex + 1));

      if (headerName) {
        result[headerName] = headerValue;
      }
    }, {});
  }
}
