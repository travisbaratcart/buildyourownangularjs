'use strict';
import {
  $HttpService,
  $HttpProvider,
  IHttpRequestConfig
} from '../src/http';
import { publishExternalAPI } from '../src/angularPublic';
import { createInjector } from '../src/injector';
import * as sinon from 'sinon';

describe('$http', () => {
  let $http: $HttpService;
  let xhr: sinon.SinonFakeXMLHttpRequest;
  let requests: sinon.SinonFakeXMLHttpRequest[];

  beforeEach(() => {
    publishExternalAPI();
    const injector = createInjector(['ng']);
    $http = injector.get('$http');
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

      expect(requests.length).toBe(1);
      expect(requests[0].requestHeaders.Accept).toBe('text/plain');
      expect(requests[0].requestHeaders['Cache-Control']).toBe('no-cache');
    });

    it('sets default headers on request', () => {
      $http.request({
        url: 'http://example.com'
      });

      expect(requests.length).toBe(1);
      expect(requests[0].requestHeaders.Accept).toBe('application/json, text/plain, */*');
    });

    it('sets method-specific default headers on request', () => {
      $http.request({
        method: 'POST',
        url: 'http://example.com',
        data: '42'
      });

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

      expect(requests[0].withCredentials).toBe(true);
    });

    it('allows setting withCredentials from defaults', () => {
      $http.defaults.withCredentials = true;

      $http.request({
        method: 'POST',
        url: 'http://example.com',
        data: 42
      });

      expect(requests[0].withCredentials).toBe(true);
    });

    it('allows transforming requests with functions', () => {
      $http.request({
        method: 'POST',
        url: 'http://example.com',
        data: 42,
        transformRequest: (data: any) => `*${data}*`
      });

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

      expect(requests[0].requestBody).toBe('-*42*-');
    });

    it('allows setting transforms in defaults', () => {
      $http.defaults.transformRequest = [(data: any) => `*${data}*`];

      $http.request({
        method: 'POST',
        url: 'http://example.com',
        data: 42
      });

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

      expect(requests[0].requestBody).toBe('*42*');
    });

    it('allows transforming responses with functions', () => {
      let receivedResponse: any;

      $http.request({
        url: 'http://example.com',
        transformResponse: (data: any) => `*${data}*`
      })
        .then(response => receivedResponse = response);

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

      requests[0].respond(401, { 'Content-Type': 'text/plain' }, 'Fail');

      expect(receivedResponse.data).toBe('unauthorized');
    });
  });
});
