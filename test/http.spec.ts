'use strict';
import {
  $HttpService,
  $HttpProvider,
  IHttpRequestConfig,
  IParams
} from '../src/http';
import { publishExternalAPI } from '../src/angularPublic';
import {
  createInjector,
  IProvide
} from '../src/injector';
import { $QService } from '../src/q';
import { Scope } from '../src/scope';
import * as sinon from 'sinon';
import * as _ from 'lodash';

describe('$http', () => {
  let $http: $HttpService;
  let $rootScope: Scope
  let xhr: sinon.SinonFakeXMLHttpRequest;
  let requests: sinon.SinonFakeXMLHttpRequest[];

  beforeEach(() => {
    publishExternalAPI();
    const injector = createInjector(['ng']);
    $http = injector.get('$http');
    $rootScope = injector.get('$rootScope');
  });

  beforeEach(() => {
    xhr = sinon.useFakeXMLHttpRequest();
    requests = [];

    xhr.onCreate = (request: sinon.SinonFakeXMLHttpRequest) => {
      requests.push(request);
    };
  });

  afterEach(() => {
    xhr.restore();
  });

  describe('request', () => {

    it('returns a promise', () => {
      const result = $http.request({ url: 'http://example.com' });
      expect(result).toBeDefined();
      expect(result.then).toBeDefined();
    });

    it('makes an XMLHttpRequest to a given url', () => {
      $http.request({
        method: 'POST',
        url: 'http://example.com',
        data: 'hello'
      });

      $rootScope.$apply();

      expect(requests.length).toBe(1);
      expect(requests[0].method).toBe('POST');
      expect(requests[0].url).toBe('http://example.com');
      expect(requests[0].async).toBe(true);
      expect(requests[0].requestBody).toBe('hello');
    });

    it('resolves promise when XHR result is received', () => {
      let receivedResponse: any;

      $http.request({
        method: 'GET',
        url: 'http://example.com'
      })
        .then((response: any) => receivedResponse = response);

      $rootScope.$apply();

      requests[0].respond(200, {}, 'Hello');

      expect(receivedResponse).toBeDefined();
      expect(receivedResponse.status).toBe(200);
      expect(receivedResponse.statusText).toBe('OK');
      expect(receivedResponse.data).toBe('Hello');
      expect(receivedResponse.config.url).toBe('http://example.com');
    });

    it('rejects promimse when XHR result received with error status', () => {
      let receivedResponse: any;

      $http.request({
        method: 'GET',
        url: 'http://example.com'
      })
        .catch((error: any) => {
          receivedResponse = error;
        });

      $rootScope.$apply();

      requests[0].respond(401, {}, 'Fail');

      expect(receivedResponse).toBeDefined();
      expect(receivedResponse.status).toBe(401);
      expect(receivedResponse.statusText).toBe('Unauthorized');
      expect(receivedResponse.data).toBe('Fail');
      expect(receivedResponse.config.url).toBe('http://example.com');
    });

    it('rejects promise when XHR result errors/aborts', () => {
      let receivedResponse: any;

      $http.request({
        method: 'GET',
        url: 'http://example.com'
      })
        .catch((error) => {
          receivedResponse = error;
        });

      $rootScope.$apply();

      requests[0].onerror();

      expect(receivedResponse).toBeDefined();
      expect(receivedResponse.status).toBe(0);
      expect(receivedResponse.data).toBe(null);
      expect(receivedResponse.config.url).toEqual('http://example.com');
    });

    it('uses GET method by default', () => {
      $http.request({
        url: 'http://example.com'
      });

      $rootScope.$apply();

      expect(requests.length).toBe(1);
      expect(requests[0].method).toBe('GET');
    });

    it('sets headers on request', () => {
      $http.request({
        url: 'http://example.com',
        headers: {
          'Accept': 'text/plain',
          'Cache-Control': 'no-cache'
        }
      });

      $rootScope.$apply();

      expect(requests.length).toBe(1);
      expect(requests[0].requestHeaders.Accept).toBe('text/plain');
      expect(requests[0].requestHeaders['Cache-Control']).toBe('no-cache');
    });

    it('sets default headers on request', () => {
      $http.request({
        url: 'http://example.com'
      });

      $rootScope.$apply();

      expect(requests.length).toBe(1);
      expect(requests[0].requestHeaders.Accept).toBe('application/json, text/plain, */*');
    });

    it('sets method-specific default headers on request', () => {
      $http.request({
        method: 'POST',
        url: 'http://example.com',
        data: '42'
      });

      $rootScope.$apply();

      expect(requests.length).toBe(1);
      expect(requests[0].requestHeaders['Content-Type'])
        .toBe('application/json;charset=utf-8');
    });

    it('exposes default headers for overriding', () => {
      $http.defaults.headers.post['Content-Type'] = 'text/plain;charset=utf-8';

      $http.request({
        method: 'POST',
        url: 'http://example.com',
        data: '42'
      });

      $rootScope.$apply();

      expect(requests.length).toBe(1);
      expect(requests[0].requestHeaders['Content-Type'])
        .toBe('text/plain;charset=utf-8');
    });

    it('exposes default headers through provider', () => {
      const injector = createInjector(['ng', function($httpProvider: $HttpProvider) {
        $httpProvider.defaults.headers.post['Content-Type']
          = 'text/plain;charset=utf-8'
      }]);

      const $http: $HttpService = injector.get('$http');

      $http.request({
        method: 'POST',
        url: 'http://example.com',
        data: '42'
      });

      const $rootScope: Scope = injector.get('$rootScope');
      $rootScope.$apply();

      expect(requests.length).toBe(1);
      expect(requests[0].requestHeaders['Content-Type'])
        .toBe('text/plain;charset=utf-8');
    });

    it('merges default headers case-insensitively', () => {
      $http.request({
        method: 'POST',
        url: 'http://example.com',
        data: 42,
        headers: {
          'content-type': 'text/plain;charset=utf-8'
        }
      });

      $rootScope.$apply();

      expect(requests.length).toBe(1);
      expect(requests[0].requestHeaders['content-type'])
        .toBe('text/plain;charset=utf-8');
      expect(requests[0].requestHeaders['Content-Type']).toBeUndefined();
    });

    it('does not send content-type header when no data', () => {
      $http.request({
        method: 'POST',
        url: 'http://example.com',
        headers: {
          'Content-Type': 'application/json;charset=utf-8'
        }
      });

      $rootScope.$apply();

      expect(requests.length).toBe(1);
      expect(requests[0].requestHeaders['Content-Type'])
        .not.toBe('application/json;charset=utf-8');
    });

    it('supports functions as header values', () => {
      const contentTypeSpy = jasmine
        .createSpy('contentType')
        .and
        .returnValue('text/plain;charset=utf-8');

      $http.defaults.headers.post['Content-Type'] = contentTypeSpy;

      const requestConfig: IHttpRequestConfig = {
        method: 'POST',
        url: 'http://example.com',
        data: 42
      }

      $http.request(requestConfig);

      $rootScope.$apply();

      expect(contentTypeSpy).toHaveBeenCalledWith(requestConfig);
      expect(requests[0].requestHeaders['Content-Type'])
        .toBe('text/plain;charset=utf-8');
    });

    it('ignores header function value when null or undefined', () => {
      const cacheControlSpy = jasmine.createSpy('cacheControl').and.returnValue(null);

      $http.defaults.headers.post['Cache-Control'] = cacheControlSpy;

      const requestConfig: IHttpRequestConfig = {
        method: 'POST',
        url: 'http://example.com',
        data: 42
      };

      $http.request(requestConfig);

      $rootScope.$apply();

      expect(cacheControlSpy).toHaveBeenCalledWith(requestConfig);
      expect(requests[0].requestHeaders['Cache-Control']).toBeUndefined();
    });

    it('makes response headers available', () => {
      let receivedResponse: any;

      $http.request({
        method: 'POST',
        url: 'http://example.com',
        data: 42
      })
        .then(response => receivedResponse = response);

      $rootScope.$apply();

      requests[0].respond(200, { 'Content-Type': 'text/plain' }, 'Hello');

      expect(receivedResponse.headers).toBeDefined();
      expect(typeof receivedResponse.headers).toBe('function');
      expect(receivedResponse.headers('Content-Type')).toBe('text/plain');
    });

    it('can return all response headers', () => {
      let receivedResponse: any;

      $http.request({
        method: 'POST',
        url: 'http://example.com',
        data: 42
      })
        .then(response => receivedResponse = response);

      $rootScope.$apply();

      requests[0].respond(200, { 'Content-Type': 'text/plain' }, 'Hello');

      expect(receivedResponse.headers()).toEqual({ 'content-type': 'text/plain' });
    });

    it('allows setting withCredentials', () => {
      $http.request({
        method: 'POST',
        url: 'http://example.com',
        data: 42,
        withCredentials: true
      });

      $rootScope.$apply();

      expect(requests[0].withCredentials).toBe(true);
    });

    it('allows setting withCredentials from defaults', () => {
      $http.defaults.withCredentials = true;

      $http.request({
        method: 'POST',
        url: 'http://example.com',
        data: 42
      });

      $rootScope.$apply();

      expect(requests[0].withCredentials).toBe(true);
    });

    it('allows transforming requests with functions', () => {
      $http.request({
        method: 'POST',
        url: 'http://example.com',
        data: 42,
        transformRequest: (data: any) => `*${data}*`
      });

      $rootScope.$apply();

      expect(requests[0].requestBody).toBe('*42*');
    });

    it('allows multiple request transform functions', () => {
      $http.request({
        method: 'POST',
        url: 'http://example.com',
        data: 42,
        transformRequest: [
          (data: any) => `*${data}*`,
          (data: any) => `-${data}-`
        ]
      });

      $rootScope.$apply();

      expect(requests[0].requestBody).toBe('-*42*-');
    });

    it('allows setting transforms in defaults', () => {
      $http.defaults.transformRequest = [(data: any) => `*${data}*`];

      $http.request({
        method: 'POST',
        url: 'http://example.com',
        data: 42
      });

      $rootScope.$apply();

      expect(requests[0].requestBody).toBe('*42*');
    })

    it('passes request headers getter to transforms', () => {
      $http.defaults.transformRequest = [(data: any, headers: (headerName: string) => string) => {
        if (headers('Content-Type') === 'text/emphasized') {
          return `*${data}*`;
        } else {
          return data;
        }
      }];

      $http.request({
        method: 'POST',
        url: 'http://example.com',
        data: 42,
        headers: {
          'content-type': 'text/emphasized'
        }
      });

      $rootScope.$apply();

      expect(requests[0].requestBody).toBe('*42*');
    });

    it('allows transforming responses with functions', () => {
      let receivedResponse: any;

      $http.request({
        url: 'http://example.com',
        transformResponse: (data: any) => `*${data}*`
      })
        .then(response => receivedResponse = response);

      $rootScope.$apply();

      requests[0].respond(200, { 'Content-Type': 'text/plain' }, 'Hello');

      expect(receivedResponse.data).toEqual('*Hello*');
    });

    it('passes response headers to transform functions', () => {
      let receivedResponse: any;

      $http.request({
        url: 'http://example.com',
        transformResponse: (data: any, headers: (headerName: string) => string) => {
          if (headers('content-type') === 'text/decorated') {
            return `*${data}*`;
          } else {
            return data;
          }
        }
      })
        .then(response => receivedResponse = response);

      $rootScope.$apply();

      requests[0].respond(200, { 'Content-Type': 'text/decorated' }, 'Hello');

      expect(receivedResponse.data).toEqual('*Hello*');
    });

    it('allows setting default response transforms', () => {
      $http.defaults.transformResponse = [(data: any) => `*${data}*`];

      let receivedResponse: any;

      $http.request({
        url: 'http://example.com'
      })
        .then(response => receivedResponse = response);

      $rootScope.$apply();

      requests[0].respond(200, { 'Content-Type': 'text/plain' }, 'Hello');

      expect(receivedResponse.data).toEqual('*Hello*');
    });

    it('transforms error responses also', () => {
      let receivedResponse: any;

      $http.request({
        url: 'http://somethingawful.com',
        transformResponse: (data) => `*${data}*`
      })
        .catch(error => receivedResponse = error);

      $rootScope.$apply();

      requests[0].respond(401, { 'Content-Type': 'text/plain' }, 'Fail');

      expect(receivedResponse.data).toEqual('*Fail*');
    });

    it('passes http status to response transformers', () => {
      let receivedResponse: any;

      $http.request({
        url: 'http://example.com',
        transformResponse: (data, headers, status) => {
          if (status === 401) {
            return 'unauthorized';
          } else {
            return data;
          }
        }
      })
        .catch(error => receivedResponse = error);

      $rootScope.$apply();

      requests[0].respond(401, { 'Content-Type': 'text/plain' }, 'Fail');

      expect(receivedResponse.data).toBe('unauthorized');
    });

    it('serializes object data to JSON for requests', () => {
      $http.request({
        method: 'POST',
        url: 'http://example.com',
        data: { aKey: 42 }
      });

      $rootScope.$apply();

      expect(requests[0].requestBody).toBe('{"aKey":42}');
    });

    it('serializes array data to JSON for requests', () => {
      $http.request({
        method: 'POST',
        url: 'http://example.com',
        data: [1, 'two', 3]
      });

      $rootScope.$apply();

      expect(requests[0].requestBody).toBe('[1,"two",3]');
    });

    it('parses JSON data for JSON responses', () => {
      let receivedResponse: any;

      $http.request({
        method: 'GET',
        url: 'http://example.com'
      })
        .then(response => receivedResponse = response);

      $rootScope.$apply();

      requests[0].respond(200, { 'Content-Type': 'application/json'}, '{ "message": "hello"}');

      expect(_.isObject(receivedResponse.data)).toBe(true);
      expect(receivedResponse.data.message).toBe('hello');
    });

    it('parses a JSON object response without content type', () => {
      let receivedResponse: any;

      $http.request({
        method: 'GET',
        url: 'http://example.com'
      })
        .then(response => receivedResponse = response);

      $rootScope.$apply();

      requests[0].respond(200, {}, '{ "message": "hello"}');

      expect(_.isObject(receivedResponse.data)).toBe(true);
      expect(receivedResponse.data.message).toBe('hello');
    });

    it('parses a JSON array response without content type', () => {
      let receivedResponse: any;

      $http.request({
        method: 'GET',
        url: 'http://example.com'
      })
        .then(response => receivedResponse = response);

      $rootScope.$apply();

      requests[0].respond(200, {}, '[1, 2, 3]');

      expect(_.isObject(receivedResponse.data)).toBe(true);
      expect(receivedResponse.data).toEqual([1, 2, 3]);
    });

    it('does not choke on response resembling JSON but not valid', () => {
      let receivedResponse: any;

      $http.request({
        method: 'GET',
        url: 'http://example.com'
      })
        .then(response => receivedResponse = response);

      $rootScope.$apply();

      requests[0].respond(200, {}, '{1, 2, 3]');

      expect(receivedResponse.data).toEqual('{1, 2, 3]');
    });

    it('does not try to parse interpolation expression as JSON', () => {
      let receivedResponse: any;

      $http.request({
        method: 'GET',
        url: 'http://example.com'
      })
        .then(response => receivedResponse = response);

      $rootScope.$apply();

      requests[0].respond(200, {}, '{{expr}}');

      expect(receivedResponse.data).toEqual('{{expr}}');
    });

    it('adds params to url', () => {
      $http.request({
        url: 'http://example.com',
        params: {
          a: 42
        }
      });

      $rootScope.$apply();

      expect(requests[0].url).toBe('http://example.com?a=42');
    });

    it('adds additional params to url', () => {
      $http.request({
        url: 'http://example.com?a=42',
        params: {
          b: 42
        }
      });

      $rootScope.$apply();

      expect(requests[0].url).toBe('http://example.com?a=42&b=42');
    });

    it('escapes url characters in params', () => {
      $http.request({
        url: 'http://example.com',
        params: {
          '==': '&&'
        }
      });

      $rootScope.$apply();

      expect(requests[0].url).toBe('http://example.com?%3D%3D=%26%26');
    });

    it('does not attach null or undefined params', () => {
      $http.request({
        url: 'http://example.com',
        params: {
          a: null,
          b: undefined
        }
      });

      $rootScope.$apply();

      expect(requests[0].url).toBe('http://example.com');
    });

    it('attaches multiple params for array inputs', () => {
      $http.request({
        url: 'http://example.com',
        params: {
          a: [42, 43]
        }
      });

      $rootScope.$apply();

      expect(requests[0].url).toBe('http://example.com?a=42&a=43');
    });

    it('serializes objects to json', () => {
      $http.request({
        url: 'http://example.com',
        params: {
          a: { b: 42 }
        }
      });

      $rootScope.$apply();

      expect(requests[0].url).toBe('http://example.com?a=%7B%22b%22%3A42%7D');
    });

    it('allows substituting a param serializer', () => {
      $http.request({
        url: 'http://example.com',
        params: {
          a: 42,
          b: 43
        },
        paramSerializer: (params: IParams) => {
          return _.map(params, (paramValue, paramName) => {
            return `${paramName}=${paramValue}lol`;
          }).join('&');
        }
      });

      $rootScope.$apply();

      expect(requests[0].url).toBe('http://example.com?a=42lol&b=43lol');
    });

    it('allows substituting param serializer through DI', () => {
      const injector = createInjector(['ng', function($provide: IProvide) {
        $provide.factory('mySpecialSerializer', () => (params: IParams) => {
          return _.map(params, (paramValue, paramName) => {
            return `${paramName}=${paramValue}lol`
          }).join('&');
        });
      }]);

      injector.invoke(function($http: $HttpService, $rootScope: Scope) {
        $http.request({
          url: 'http://example.com',
          params: {
            a: 42,
            b: 43
          },
          paramSerializer: 'mySpecialSerializer'
        });

        $rootScope.$apply();

        expect(requests[0].url).toBe('http://example.com?a=42lol&b=43lol');
      });
    });

    it('makes default param serializer available through DI', () => {
      const injector = createInjector(['ng']);

      injector.invoke(function($httpParamSerializer: (params: IParams) => string) {
        const result = $httpParamSerializer({
          a: 42,
          b: 43
        });

        expect(result).toBe('a=42&b=43');
      })
    });
  });

  describe('JQ-Like param serialization', () => {
    it('is possible', () => {
      $http.request({
        url: 'http://example.com',
        params: {
          a: 42,
          b: 43
        },
        paramSerializer: '$httpParamSerializerJQLike'
      });

      $rootScope.$apply();

      expect(requests[0].url).toBe('http://example.com?a=42&b=43');
    });

    it('uses square brackets in arrays', () => {
      $http.request({
        url: 'http://example.com',
        params: {
          a: [42, 43]
        },
        paramSerializer: '$httpParamSerializerJQLike'
      });

      $rootScope.$apply();

      expect(requests[0].url).toBe('http://example.com?a%5B%5D=42&a%5B%5D=43');
    });

    it('uses square brackets in objects', () => {
      $http.request({
        url: 'http://example.com',
        params: {
          a: {
            b: 42,
            c: 43
          }
        },
        paramSerializer: '$httpParamSerializerJQLike'
      });

      $rootScope.$apply();

      expect(requests[0].url).toBe('http://example.com?a%5Bb%5D=42&a%5Bc%5D=43');
    });

    it('supports nesting in objects', () => {
      $http.request({
        url: 'http://example.com',
        params: {
          a: {
            b: {
              c: 42
            }
          }
        },
        paramSerializer: '$httpParamSerializerJQLike'
      });

      $rootScope.$apply();

      expect(requests[0].url).toBe('http://example.com?a%5Bb%5D%5Bc%5D=42');
    });

    it('appends array indexes when items are objects', () => {
      $http.request({
        url: 'http://example.com',
        params: {
          a: [{
            b: 42
          }]
        },
        paramSerializer: '$httpParamSerializerJQLike'
      });

      $rootScope.$apply();

      expect(requests[0].url).toEqual('http://example.com?a%5B0%5D%5Bb%5D=42')
    });
  });

  describe('shorthands', () => {
    it('supports a shorthand method for GET', () => {
      $http.get('http://example.com', {
        params: { q: 42 }
      });

      $rootScope.$apply();

      expect(requests[0].url).toBe('http://example.com?q=42');
      expect(requests[0].method).toBe('GET');
    });

    it('supports a shorthand method for HEAD', () => {
      $http.head('http://example.com', {
        params: { q: 42 }
      });

      $rootScope.$apply();

      expect(requests[0].url).toBe('http://example.com?q=42');
      expect(requests[0].method).toBe('HEAD');
    });

    it('supports a shorthand method for DELETE', () => {
      $http.delete('http://example.com', {
        params: { q: 42 }
      });

      $rootScope.$apply();

      expect(requests[0].url).toBe('http://example.com?q=42');
      expect(requests[0].method).toBe('DELETE');
    });

    it('supports shorthand method for POST with data', () => {
      $http.post('http://example.com', 'data', {
        params: { q: 42 }
      });

      $rootScope.$apply();

      expect(requests[0].url).toBe('http://example.com?q=42');
      expect(requests[0].method).toBe('POST');
      expect(requests[0].requestBody).toBe('data');
    });

    it('supports shorthand method for PUT with data', () => {
      $http.put('http://example.com', 'data', {
        params: { q: 42 }
      });

      $rootScope.$apply();

      expect(requests[0].url).toBe('http://example.com?q=42');
      expect(requests[0].method).toBe('PUT');
      expect(requests[0].requestBody).toBe('data');
    });

    it('supports shorthand method for PATCH with data', () => {
      $http.patch('http://example.com', 'data', {
        params: { q: 42 }
      });

      $rootScope.$apply();

      expect(requests[0].url).toBe('http://example.com?q=42');
      expect(requests[0].method).toBe('PATCH');
      expect(requests[0].requestBody).toBe('data');
    });
  });

  describe('interceptors', () => {
    it('allows attaching interceptor factories', () => {
      const interceptorFactorySpy = jasmine.createSpy('interceptorFactory');

      const injector = createInjector(['ng', function($httpProvider: $HttpProvider) {
        $httpProvider.interceptors.push(interceptorFactorySpy);
      }]);

      $http = injector.get('$http');

      expect(interceptorFactorySpy).toHaveBeenCalled();
    });

    it('uses DI to instantiate interceptors', () => {
      const interceptorFactorySpy = jasmine.createSpy('interceptorFactory');

      const injector = createInjector(['ng', function($httpProvider: $HttpProvider) {
        $httpProvider.interceptors.push(['$rootScope', interceptorFactorySpy]);
      }])
    });

    it('allows referencing existing interceptor factories', () => {
      const injectorFactorySpy = jasmine.createSpy('injectorFactory').and.returnValue({});

      const injector = createInjector(['ng', function($provide: IProvide, $httpProvider: $HttpProvider) {
        $provide.factory('myInterceptor', injectorFactorySpy);
        $httpProvider.interceptors.push('myInterceptor');
      }]);

      $http = injector.get('$http');

      expect(injectorFactorySpy).toHaveBeenCalled();
    });

    it('allows intercepting requests', () => {
      const injector = createInjector(['ng', function($httpProvider: $HttpProvider) {
        $httpProvider.interceptors.push(function() {
          return {
            request: function(config: IHttpRequestConfig) {
              config.params.intercepted = true;
              return config;
            }
          };
        });
      }]);

      const $http: $HttpService = injector.get('$http');
      const $rootScope: Scope = injector.get('$rootScope');

      $http.get('http://example.com', { params: {} });
      $rootScope.$apply();

      expect(requests[0].url).toBe('http://example.com?intercepted=true');
    });

    it('allows returning promises from request interceptors', () => {
      const injector = createInjector(['ng', function($httpProvider: $HttpProvider) {
        $httpProvider.interceptors.push(function($q: $QService) {
          return {
            request: function(config: IHttpRequestConfig) {
              config.params.intercepted = true;
              return $q.when(config);
            }
          };
        });
      }]);

      const $http: $HttpService = injector.get('$http');
      const $rootScope: Scope = injector.get('$rootScope');

      $http.get('http://example.com', { params: {} });

      $rootScope.$apply();
      expect(requests[0].url).toBe('http://example.com?intercepted=true');
    });
  });
});
