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

type DataTransformFunction = (data: any) => any;

interface IHeaderObject {
  [ headerName: string ]: string
}

export interface IHttpRequestConfig {
  url: string;
  method?: string;
  data?: any
  headers?: { [ headerName: string ]: string};
  withCredentials?: boolean;
  transformRequest?: DataTransformFunction | DataTransformFunction[];
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

    const requestData = this.transformData(config.data, config.transformRequest);

    this.$httpBackend.request(
      config.method,
      config.url,
      requestData,
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

    this.setDefaultTransformsIfNecessary(config);
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

  private transformData(
    data: any,
    transform: DataTransformFunction | DataTransformFunction[]): any {
    if (typeof transform === 'function') {
      return transform(data);
    } else if (Array.isArray(transform)) {
      return transform.reduce((data, transformFunction) => {
        return transformFunction(data);
      }, data)
    } else {
      return data;
    }
  }

  private setDefaultTransformsIfNecessary(config: IHttpRequestConfig) {
    const configTransforms = config.transformRequest;
    const defaultTransforms = this.defaults.transformRequest;

    const mergedTransformFunctions: DataTransformFunction[] = [];

    if (Array.isArray(configTransforms)) {
      configTransforms.forEach(configTransform => {
        mergedTransformFunctions.push(configTransform)
      });
    } else if (typeof configTransforms === 'function') {
      mergedTransformFunctions.push(configTransforms);
    }

    if (Array.isArray(defaultTransforms)) {
      defaultTransforms.forEach((defaultTransform: DataTransformFunction) => {
        mergedTransformFunctions.push(defaultTransform)
      });
    } else if (typeof defaultTransforms === 'function') {
      mergedTransformFunctions.push(defaultTransforms);
    }

    config.transformRequest = mergedTransformFunctions;
  }
}
