'use strict';
import { IProvider, Injector } from './injector';
import { $HttpBackendService } from './httpBackend';
import { $QService, Promise } from './q';
import { Scope } from './scope';
import * as _ from 'lodash';

export class $HttpProvider {
  public $get = ['$httpBackend', '$injector', '$q', '$rootScope', function(
    $httpBackend: $HttpBackendService,
    $injector: Injector,
    $q: $QService,
    $rootScope: Scope) {

    return new $HttpService($httpBackend, $injector, $q, $rootScope, this.defaults);
  }];

  public defaults: any = {
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
    },
    transformRequest: [(data: any) => {
      if (_.isObject(data)) {
        return JSON.stringify(data);
      } else {
        return data;
      }
    }],
    transformResponse: [(data: any, headers: (headerName: string) => string) => {
      if (typeof data === 'string') {
        const contentType = headers('Content-Type');

        if (contentType === 'application/json' || looksLikeJson(data)) {
          return JSON.parse(data)
        }
      }

      return data;
    }],
    paramSerializer: '$httpParamSerializer'
  };
}

type DataTransformFunction = (data: any, headers?: (headerName: string) => string | IHeaderObject, statusCode?: number) => any;

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
  transformResponse?: DataTransformFunction | DataTransformFunction[];
  params?: IParams;
  paramSerializer?: ((params: IParams) => string) | string;
}

export interface IParams {
  [name: string]: any;
};

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
    private $injector: Injector,
    private $q: $QService,
    private $rootScope: Scope,
    public defaults: any) {
  }

  public request(config: IHttpRequestConfig): Promise {
    this.setConfigDefaultsIfNecessary(config);

    const requestData = this.transformData(
      config.data,
      this.getHeaderGetter(config.headers),
      null,
      config.transformRequest);

    return this.sendRequest(config, requestData)
      .then(
        (response) => this.transformResponse(response, config),
        (response) => this.transformResponse(response, config));
  }

  private sendRequest(config: IHttpRequestConfig, data: any) {
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
      this.buildUrl(config),
      data,
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

    this.setDefaultTransformsIfNecessary(config, 'transformRequest');
    this.setDefaultTransformsIfNecessary(config, 'transformResponse');
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
    headers: any): (headerName: string) => string | IHeaderObject {

    let headersObject: { [ headerName: string ]: string };

    return (headerName: string) => {
      headersObject = headersObject || this.parseHeaders(headers);

      return headerName
        ? headersObject[headerName.toLowerCase()]
        : headersObject;
    }

  }

  private parseHeaders(headers: any): { [ headerName: string ]: string} {

    if (_.isObject(headers)) {
      return <IHeaderObject>_.transform(headers, (result: any, headerValue: string, headerName: string) => {
        result[_.trim(headerName.toLowerCase())] = _.trim(headerValue);
      });
    } else {
      const headerLines = headers.split('\n');

      return <{ [ headerName: string ]: string}>_.transform(headerLines, (result: any, line: string) => {
        const separatorIndex = line.indexOf(':');
        const headerName = _.trim(line.substr(0, separatorIndex)).toLowerCase();
        const headerValue = _.trim(line.substr(separatorIndex + 1));

        if (headerName) {
          result[headerName] = headerValue;
        }
      }, {});
    }
  }

  private transformResponse(response: IHttpResponse, config: IHttpRequestConfig): any {
    if (response.data) {
      response.data = this.transformData(response.data, response.headers, response.status, config.transformResponse);
    }

    if (this.isSuccess(response.status)) {
      return response;
    } else {
      return this.$q.reject(response);
    }
  }

  private transformData(
    data: any,
    headers: (headerName: string) => string | IHeaderObject,
    statusCode: number,
    transform: DataTransformFunction | DataTransformFunction[]): any {
    if (typeof transform === 'function') {
      return transform(data, headers, statusCode);
    } else if (Array.isArray(transform)) {
      return transform.reduce((data, transformFunction) => {
        return transformFunction(data, headers, statusCode);
      }, data)
    } else {
      return data;
    }
  }

  private setDefaultTransformsIfNecessary(config: IHttpRequestConfig, transformKey: 'transformRequest' | 'transformResponse') {
    const configTransforms = config[transformKey];
    const defaultTransforms = this.defaults[transformKey];

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

    config[transformKey] = mergedTransformFunctions;
  }

  private buildUrl(config: IHttpRequestConfig): string {
    const paramSerializer = this.getParamSerializer(config);

    const serializedParams = paramSerializer(config.params);

    let newUrl = config.url;

    if (serializedParams) {
      const urlAlreadyHasParams = config.url.indexOf('?') > -1;

      newUrl += (urlAlreadyHasParams ? '&' : '?');
      newUrl += serializedParams;
    }

    return newUrl;
  }

  private getParamSerializer(config: IHttpRequestConfig): (params: IParams) => string {
    const paramSerializerOrName = config.paramSerializer || this.defaults.paramSerializer;

    return typeof paramSerializerOrName === 'function'
      ? paramSerializerOrName
      : this.$injector.get(paramSerializerOrName);
  }
}


function looksLikeJson(str: string): boolean {
  const looksLikeObject = str.match(/^{(?!{)/) && str.match(/\}$/);
  const looksLikeArray = str.match(/^\[/) && str.match(/\]$/)
  return !!(looksLikeObject || looksLikeArray)
}

export class $HttpParamSerializerProvider implements IProvider {
  public $get() {
    return (params: IParams) => this.serializeParams(params);
  }

  private serializeParams(params: IParams): string {
    let components: string[] = [];

    _.forEach(params, (paramValue, paramName) => {
      if (paramValue === null || paramValue === undefined) {
        return;
      }

      if (Array.isArray(paramValue)) {
        paramValue.forEach(paramElement => {
          components.push(this.getParamString(paramName, paramElement));
        });
      } else if (typeof paramValue === 'object') {
        components.push(this.getParamString(paramName, JSON.stringify(paramValue)));
      } else {
        components.push(this.getParamString(paramName, paramValue));
      }
    });

    return components.join('&');
  }

  private getParamString(paramName: string, paramValue: any) {
    return `${encodeURIComponent(paramName)}=${encodeURIComponent(paramValue)}`
  }
}
