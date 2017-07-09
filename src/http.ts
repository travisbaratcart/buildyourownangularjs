'use strict';
import { IProvider, Injector, Invokable } from './injector';
import { $HttpBackendService } from './httpBackend';
import { $QService, Promise } from './q';
import { Scope } from './scope';
import * as _ from 'lodash';

interface IInterceptor {
  request?: (config: IHttpRequestConfig) => IHttpRequestConfig;
  response?: (config: IHttpResponse) => IHttpResponse;
  requestError?: (error: any) => any;
  responseError?: (error: any) => any;
}

interface IHttpResponsePromise extends Promise {
  success: (cb: (data: any, statusCode: number, headers: (headerName: string) => string | IHeaderObject, config: IHttpRequestConfig) => any) => void;
  error: (cb: (data: any, statusCode: number, headers: (headerName: string) => string | IHeaderObject, config: IHttpRequestConfig) => any) => void;
}

export class $HttpProvider {
  public $get = ['$httpBackend', '$injector', '$q', '$rootScope', (
    $httpBackend: $HttpBackendService,
    $injector: Injector,
    $q: $QService,
    $rootScope: Scope) => {

    const interceptors = this.interceptors.map(interceptorNameOrFactory => {
      return typeof interceptorNameOrFactory === 'string'
        ? $injector.get(interceptorNameOrFactory)
        : $injector.invoke(interceptorNameOrFactory);
    });

    return new $HttpService(
      $httpBackend,
      $injector,
      $q,
      $rootScope,
      this.defaults,
      interceptors);
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

  public interceptors: (Invokable | string)[] = [];
}

type DataTransformFunction = (data: any, headers?: (headerName: string) => string | IHeaderObject, statusCode?: number) => any;

export interface IHeaderObject {
  [ headerName: string ]: string
}

interface IShortHandHttpRequestConfig {
  data?: any
  headers?: { [ headerName: string ]: string};
  withCredentials?: boolean;
  transformRequest?: DataTransformFunction | DataTransformFunction[];
  transformResponse?: DataTransformFunction | DataTransformFunction[];
  params?: IParams;
  paramSerializer?: ((params: IParams) => string) | string;
  timeout?: Promise;
}

export interface IHttpRequestConfig extends IShortHandHttpRequestConfig {
  url: string;
  method?: string;
}

export interface IParams {
  [name: string]: any;
};

export interface IHttpResponse {
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
    public defaults: any,
    private interceptors: IInterceptor[]) {
  }

  public request(config: IHttpRequestConfig): IHttpResponsePromise {
    this.setConfigDefaultsIfNecessary(config);

    const initialPromise = this.$q.when(config);

    const returnPromise = <IHttpResponsePromise>initialPromise
      .then((config: IHttpRequestConfig) => this.applyRequestInterceptors(config))
      .then((config: IHttpRequestConfig) => this.serverRequest(config))
      .then((response: IHttpResponse) => this.applyResponseInterceptors(response));

    returnPromise.success = (cb) => {
      returnPromise.then((response: IHttpResponse) => {
        cb(response.data, response.status, response.headers, config);
      });
    }

    returnPromise.error = (cb) => {
      returnPromise.catch((response: IHttpResponse) => {
        cb(response.data, response.status, response.headers, config);
      });
    }

    return returnPromise;
  }

  public get(url: string, config?: IShortHandHttpRequestConfig): IHttpResponsePromise {
    return this.shortHandRequest(url, 'GET', undefined, config);
  }

  public head(url: string, config?: IShortHandHttpRequestConfig): IHttpResponsePromise {
    return this.shortHandRequest(url, 'HEAD', undefined, config);
  }

  public delete(url: string, config?: IShortHandHttpRequestConfig): IHttpResponsePromise {
    return this.shortHandRequest(url, 'DELETE', undefined, config);
  }

  public post(url: string, data?: any, config?: IShortHandHttpRequestConfig): IHttpResponsePromise {
    return this.shortHandRequest(url, 'POST', data, config);
  }

  public put(url: string, data?: any, config?: IShortHandHttpRequestConfig): IHttpResponsePromise {
    return this.shortHandRequest(url, 'PUT', data, config);
  }

  public patch(url: string, data?: any, config?: IShortHandHttpRequestConfig): IHttpResponsePromise {
    return this.shortHandRequest(url, 'PATCH', data, config);
  }

  private shortHandRequest(
    url: string,
    method: string,
    data?: any,
    config?: IShortHandHttpRequestConfig): IHttpResponsePromise {
    const fullConfig = _.extend(config || {}, {
      method,
      data,
      url
    });

    return this.request(fullConfig);
  }

  private serverRequest(config: IHttpRequestConfig): Promise {
    const requestData = this.transformData(
      config.data,
      this.getHeaderGetter(config.headers),
      null,
      config.transformRequest);

    return this.sendServerRequest(config, requestData)
      .then(
        (response) => this.transformResponse(response, config),
        (response) => this.transformResponse(response, config));
  }

  private sendServerRequest(config: IHttpRequestConfig, data: any): Promise {
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

    const deferred = this.$q.defer();

    this.$httpBackend.request(
      config.method,
      this.buildUrl(config),
      data,
      onDone,
      config.headers,
      config.timeout,
      config.withCredentials);

    return deferred.promise;
  }

  private applyRequestInterceptors(config: IHttpRequestConfig): Promise {
    const initialPromise = this.$q.when(config);

    const result = this.interceptors.reduce((result: Promise, interceptor: IInterceptor) => {
      let newPromise = result;

      if (interceptor.request) {
        newPromise = newPromise
          .then((config: IHttpRequestConfig) => interceptor.request(config))
      }

      if (interceptor.requestError) {
        newPromise = newPromise
          .catch((error: any) => interceptor.requestError(error));
      }

      return newPromise;

    }, initialPromise);

    return result;
  }

  private applyResponseInterceptors(response: IHttpResponse): Promise {
    const initialPromise = this.$q.when(response);

    const result = this.interceptors.reduceRight((result: Promise, interceptor: IInterceptor) => {
      let newPromise = result;

      if (interceptor.response) {
        newPromise = newPromise
          .then((response: IHttpResponse) => interceptor.response(response));
      }

      if (interceptor.responseError) {
        newPromise = newPromise
          .catch((error: any) => interceptor.responseError(error));
      }

      return newPromise
    }, initialPromise);

    return result;
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

export class $HttpParamSerializerJQLikeProvider implements IProvider {
  public $get() {
    return (params: IParams) => this.serializeParams(params);
  }

  private serializeParams(params: IParams): string {
    const components: string[] = [];

    _.forEach(params, (paramValue, paramName) => {
      const serializedParam = this.serializeParam(paramValue, paramName);

      if (serializedParam) {
        components.push(serializedParam);
      }
    });

    return components.join('&');
  }

  private serializeParam(paramValue: any, paramName: string): string {
    if (paramValue === null || paramValue === undefined) {
        return;
      }

      if (Array.isArray(paramValue)) {
        return this.serializeArray(paramValue, paramName);
      } else if (typeof paramValue === 'object' && !(paramValue instanceof Date)) {
        return this.serializeObject(paramValue, paramName);
      } else {
        return this.serializeRegularParam(paramValue, paramName);
      }
  }

  private serializeArray(paramValue: any[], paramName: string): string {
    return paramValue.map((val, index) => {
      if (typeof val === 'object') {
        return this.serializeObject(val, `${paramName}[${index}]`);
      } else {
        return this.serializeRegularParam(val, `${paramName}[]`);
      }
    }).join('&');
  }

  private serializeObject(paramValue: any, paramName: string, prefix?: string): string {
    return _.map(paramValue, (value: any, key: string) => {
      const newPrefix = prefix
          ? `${prefix}[${paramName}]`
          : paramName;
      if (typeof value === 'object') {
        return this.serializeObject(value, key, newPrefix);
      } else {
        return this.serializeRegularParam(value, `${newPrefix}[${key}]`);
      }
    }).join('&');
  }

  private serializeRegularParam(paramValue: any, paramName: string): string {
    return `${encodeURIComponent(paramName)}=${encodeURIComponent(paramValue)}`;
  }
}
