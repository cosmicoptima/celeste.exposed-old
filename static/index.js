(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
var axios = require("axios");
var scriptjs = require("scriptjs");
var wikidata = require("wikidata-sdk");

var rows = {};

function randomChoice(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomProperty(f) {
  // while (rowsLock) {console.log("waiting for rows");}
  f(randomChoice(rows));
}

function randomTriple(f) {
  randomProperty((property) => {
    let [propertyID, propertyName] = property;
    // ID properties aren't very fun; we will forbid them
    // this is not completely accurate and never will be
    let pnLower = propertyName.toLowerCase();
    if (
      pnLower.includes("code") ||
      pnLower.includes("id") ||
      pnLower.includes("identifier") ||
      pnLower.includes("slug")
    ) {
      randomTriple(f);
      return;
    }

    let query = `SELECT ?aLabel ?bLabel
                 WHERE {
                   ?a wdt:${propertyID} ?b.
                   SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
                 }
                 LIMIT 100`;
    axios.get(wikidata.sparqlQuery(query)).then((res) => {
      let choices = res.data.results.bindings;
      if (choices.length > 0) {
        let choice = randomChoice(res.data.results.bindings);
        let [a, b] = [choice.aLabel.value, choice.bLabel.value];

        // unnamed objects aren't very fun either
        // (such objects have labels like Q123456789)
        if (!isNaN(parseInt(a.slice(1)))) {
          randomTriple(f);
          return;
        }

        if (b.startsWith("http://") || b.startsWith("https://")) {
          b = "<a href='" + b + "'>[link]</a>";
        }

        f(a, propertyName, b);
      } else randomTriple(f);
    });
  });
}

function setFunFact(a, p, b) {
  let pFirstWord = p.split(" ")[0];
  if (pFirstWord.endsWith("ed") || p.endsWith(" of") || p.endsWith(" to")) {
    var prefix = "is ";
  } else if (pFirstWord.endsWith("s")) {
    var prefix = "";
  } else {
    var prefix = "has ";
  }

  document.getElementById(
    "fun-fact"
  ).innerHTML = `${a} <b>${prefix}${p}</b> ${b}`;
}

function reload() {
  document.getElementById("fun-fact").innerHTML = "<i>loading…</i>";
  randomTriple(setFunFact);
}

scriptjs(
  "https://cdn.jsdelivr.net/npm/jaaulde-cookies/lib/jaaulde-cookies.min.js",
  () => {
    var visits = parseInt(cookies.get("visits"));
    if (isNaN(visits)) visits = 1;
    else visits++;
    cookies.set("visits", visits);

    if (visits < 1) {
      var visitMessage = `you have apparently visited this site ${visits} times.`;
    } else if (visits === 1) {
      var visitMessage = "you have visited this site 1 time. welcome!";
    } else if (visits < 5) {
      var visitMessage = `you have visited this site ${visits} times. that is a normal amount.`;
    } else if (visits < 25) {
      var visitMessage = `you have visited this site ${visits} times. are you procrastinating?`;
    } else {
      var visitMessage = `you have visited this site ${visits} times. this is getting creepy!`;
    }

    document.getElementById("subheader").innerHTML = randomChoice([
      visitMessage,
      visitMessage,
      visitMessage,
      "you have lost the game!",
      "you have lost the game!",
      "you are now in control of your blinking!",
      "you are now in control of your breathing!",
      "you may now attend to that itch you've been neglecting!",
    ]);
  }
);


axios.get("https://quarry.wmcloud.org/run/45013/output/1/json").then((res) => {
  rows = res.data.rows;
  console.log(rows);
  randomTriple(setFunFact);
  document.getElementById("reload-fun-fact").onclick = reload;
});
},{"axios":2,"scriptjs":31,"wikidata-sdk":60}],2:[function(require,module,exports){
module.exports = require('./lib/axios');
},{"./lib/axios":4}],3:[function(require,module,exports){
'use strict';

var utils = require('./../utils');
var settle = require('./../core/settle');
var cookies = require('./../helpers/cookies');
var buildURL = require('./../helpers/buildURL');
var buildFullPath = require('../core/buildFullPath');
var parseHeaders = require('./../helpers/parseHeaders');
var isURLSameOrigin = require('./../helpers/isURLSameOrigin');
var createError = require('../core/createError');
var defaults = require('../defaults');
var Cancel = require('../cancel/Cancel');

module.exports = function xhrAdapter(config) {
  return new Promise(function dispatchXhrRequest(resolve, reject) {
    var requestData = config.data;
    var requestHeaders = config.headers;
    var responseType = config.responseType;
    var onCanceled;
    function done() {
      if (config.cancelToken) {
        config.cancelToken.unsubscribe(onCanceled);
      }

      if (config.signal) {
        config.signal.removeEventListener('abort', onCanceled);
      }
    }

    if (utils.isFormData(requestData)) {
      delete requestHeaders['Content-Type']; // Let the browser set it
    }

    var request = new XMLHttpRequest();

    // HTTP basic authentication
    if (config.auth) {
      var username = config.auth.username || '';
      var password = config.auth.password ? unescape(encodeURIComponent(config.auth.password)) : '';
      requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password);
    }

    var fullPath = buildFullPath(config.baseURL, config.url);
    request.open(config.method.toUpperCase(), buildURL(fullPath, config.params, config.paramsSerializer), true);

    // Set the request timeout in MS
    request.timeout = config.timeout;

    function onloadend() {
      if (!request) {
        return;
      }
      // Prepare the response
      var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null;
      var responseData = !responseType || responseType === 'text' ||  responseType === 'json' ?
        request.responseText : request.response;
      var response = {
        data: responseData,
        status: request.status,
        statusText: request.statusText,
        headers: responseHeaders,
        config: config,
        request: request
      };

      settle(function _resolve(value) {
        resolve(value);
        done();
      }, function _reject(err) {
        reject(err);
        done();
      }, response);

      // Clean up request
      request = null;
    }

    if ('onloadend' in request) {
      // Use onloadend if available
      request.onloadend = onloadend;
    } else {
      // Listen for ready state to emulate onloadend
      request.onreadystatechange = function handleLoad() {
        if (!request || request.readyState !== 4) {
          return;
        }

        // The request errored out and we didn't get a response, this will be
        // handled by onerror instead
        // With one exception: request that using file: protocol, most browsers
        // will return status as 0 even though it's a successful request
        if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf('file:') === 0)) {
          return;
        }
        // readystate handler is calling before onerror or ontimeout handlers,
        // so we should call onloadend on the next 'tick'
        setTimeout(onloadend);
      };
    }

    // Handle browser request cancellation (as opposed to a manual cancellation)
    request.onabort = function handleAbort() {
      if (!request) {
        return;
      }

      reject(createError('Request aborted', config, 'ECONNABORTED', request));

      // Clean up request
      request = null;
    };

    // Handle low level network errors
    request.onerror = function handleError() {
      // Real errors are hidden from us by the browser
      // onerror should only fire if it's a network error
      reject(createError('Network Error', config, null, request));

      // Clean up request
      request = null;
    };

    // Handle timeout
    request.ontimeout = function handleTimeout() {
      var timeoutErrorMessage = config.timeout ? 'timeout of ' + config.timeout + 'ms exceeded' : 'timeout exceeded';
      var transitional = config.transitional || defaults.transitional;
      if (config.timeoutErrorMessage) {
        timeoutErrorMessage = config.timeoutErrorMessage;
      }
      reject(createError(
        timeoutErrorMessage,
        config,
        transitional.clarifyTimeoutError ? 'ETIMEDOUT' : 'ECONNABORTED',
        request));

      // Clean up request
      request = null;
    };

    // Add xsrf header
    // This is only done if running in a standard browser environment.
    // Specifically not if we're in a web worker, or react-native.
    if (utils.isStandardBrowserEnv()) {
      // Add xsrf header
      var xsrfValue = (config.withCredentials || isURLSameOrigin(fullPath)) && config.xsrfCookieName ?
        cookies.read(config.xsrfCookieName) :
        undefined;

      if (xsrfValue) {
        requestHeaders[config.xsrfHeaderName] = xsrfValue;
      }
    }

    // Add headers to the request
    if ('setRequestHeader' in request) {
      utils.forEach(requestHeaders, function setRequestHeader(val, key) {
        if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
          // Remove Content-Type if data is undefined
          delete requestHeaders[key];
        } else {
          // Otherwise add header to the request
          request.setRequestHeader(key, val);
        }
      });
    }

    // Add withCredentials to request if needed
    if (!utils.isUndefined(config.withCredentials)) {
      request.withCredentials = !!config.withCredentials;
    }

    // Add responseType to request if needed
    if (responseType && responseType !== 'json') {
      request.responseType = config.responseType;
    }

    // Handle progress if needed
    if (typeof config.onDownloadProgress === 'function') {
      request.addEventListener('progress', config.onDownloadProgress);
    }

    // Not all browsers support upload events
    if (typeof config.onUploadProgress === 'function' && request.upload) {
      request.upload.addEventListener('progress', config.onUploadProgress);
    }

    if (config.cancelToken || config.signal) {
      // Handle cancellation
      // eslint-disable-next-line func-names
      onCanceled = function(cancel) {
        if (!request) {
          return;
        }
        reject(!cancel || (cancel && cancel.type) ? new Cancel('canceled') : cancel);
        request.abort();
        request = null;
      };

      config.cancelToken && config.cancelToken.subscribe(onCanceled);
      if (config.signal) {
        config.signal.aborted ? onCanceled() : config.signal.addEventListener('abort', onCanceled);
      }
    }

    if (!requestData) {
      requestData = null;
    }

    // Send the request
    request.send(requestData);
  });
};

},{"../cancel/Cancel":5,"../core/buildFullPath":10,"../core/createError":11,"../defaults":17,"./../core/settle":15,"./../helpers/buildURL":20,"./../helpers/cookies":22,"./../helpers/isURLSameOrigin":25,"./../helpers/parseHeaders":27,"./../utils":30}],4:[function(require,module,exports){
'use strict';

var utils = require('./utils');
var bind = require('./helpers/bind');
var Axios = require('./core/Axios');
var mergeConfig = require('./core/mergeConfig');
var defaults = require('./defaults');

/**
 * Create an instance of Axios
 *
 * @param {Object} defaultConfig The default config for the instance
 * @return {Axios} A new instance of Axios
 */
function createInstance(defaultConfig) {
  var context = new Axios(defaultConfig);
  var instance = bind(Axios.prototype.request, context);

  // Copy axios.prototype to instance
  utils.extend(instance, Axios.prototype, context);

  // Copy context to instance
  utils.extend(instance, context);

  // Factory for creating new instances
  instance.create = function create(instanceConfig) {
    return createInstance(mergeConfig(defaultConfig, instanceConfig));
  };

  return instance;
}

// Create the default instance to be exported
var axios = createInstance(defaults);

// Expose Axios class to allow class inheritance
axios.Axios = Axios;

// Expose Cancel & CancelToken
axios.Cancel = require('./cancel/Cancel');
axios.CancelToken = require('./cancel/CancelToken');
axios.isCancel = require('./cancel/isCancel');
axios.VERSION = require('./env/data').version;

// Expose all/spread
axios.all = function all(promises) {
  return Promise.all(promises);
};
axios.spread = require('./helpers/spread');

// Expose isAxiosError
axios.isAxiosError = require('./helpers/isAxiosError');

module.exports = axios;

// Allow use of default import syntax in TypeScript
module.exports.default = axios;

},{"./cancel/Cancel":5,"./cancel/CancelToken":6,"./cancel/isCancel":7,"./core/Axios":8,"./core/mergeConfig":14,"./defaults":17,"./env/data":18,"./helpers/bind":19,"./helpers/isAxiosError":24,"./helpers/spread":28,"./utils":30}],5:[function(require,module,exports){
'use strict';

/**
 * A `Cancel` is an object that is thrown when an operation is canceled.
 *
 * @class
 * @param {string=} message The message.
 */
function Cancel(message) {
  this.message = message;
}

Cancel.prototype.toString = function toString() {
  return 'Cancel' + (this.message ? ': ' + this.message : '');
};

Cancel.prototype.__CANCEL__ = true;

module.exports = Cancel;

},{}],6:[function(require,module,exports){
'use strict';

var Cancel = require('./Cancel');

/**
 * A `CancelToken` is an object that can be used to request cancellation of an operation.
 *
 * @class
 * @param {Function} executor The executor function.
 */
function CancelToken(executor) {
  if (typeof executor !== 'function') {
    throw new TypeError('executor must be a function.');
  }

  var resolvePromise;

  this.promise = new Promise(function promiseExecutor(resolve) {
    resolvePromise = resolve;
  });

  var token = this;

  // eslint-disable-next-line func-names
  this.promise.then(function(cancel) {
    if (!token._listeners) return;

    var i;
    var l = token._listeners.length;

    for (i = 0; i < l; i++) {
      token._listeners[i](cancel);
    }
    token._listeners = null;
  });

  // eslint-disable-next-line func-names
  this.promise.then = function(onfulfilled) {
    var _resolve;
    // eslint-disable-next-line func-names
    var promise = new Promise(function(resolve) {
      token.subscribe(resolve);
      _resolve = resolve;
    }).then(onfulfilled);

    promise.cancel = function reject() {
      token.unsubscribe(_resolve);
    };

    return promise;
  };

  executor(function cancel(message) {
    if (token.reason) {
      // Cancellation has already been requested
      return;
    }

    token.reason = new Cancel(message);
    resolvePromise(token.reason);
  });
}

/**
 * Throws a `Cancel` if cancellation has been requested.
 */
CancelToken.prototype.throwIfRequested = function throwIfRequested() {
  if (this.reason) {
    throw this.reason;
  }
};

/**
 * Subscribe to the cancel signal
 */

CancelToken.prototype.subscribe = function subscribe(listener) {
  if (this.reason) {
    listener(this.reason);
    return;
  }

  if (this._listeners) {
    this._listeners.push(listener);
  } else {
    this._listeners = [listener];
  }
};

/**
 * Unsubscribe from the cancel signal
 */

CancelToken.prototype.unsubscribe = function unsubscribe(listener) {
  if (!this._listeners) {
    return;
  }
  var index = this._listeners.indexOf(listener);
  if (index !== -1) {
    this._listeners.splice(index, 1);
  }
};

/**
 * Returns an object that contains a new `CancelToken` and a function that, when called,
 * cancels the `CancelToken`.
 */
CancelToken.source = function source() {
  var cancel;
  var token = new CancelToken(function executor(c) {
    cancel = c;
  });
  return {
    token: token,
    cancel: cancel
  };
};

module.exports = CancelToken;

},{"./Cancel":5}],7:[function(require,module,exports){
'use strict';

module.exports = function isCancel(value) {
  return !!(value && value.__CANCEL__);
};

},{}],8:[function(require,module,exports){
'use strict';

var utils = require('./../utils');
var buildURL = require('../helpers/buildURL');
var InterceptorManager = require('./InterceptorManager');
var dispatchRequest = require('./dispatchRequest');
var mergeConfig = require('./mergeConfig');
var validator = require('../helpers/validator');

var validators = validator.validators;
/**
 * Create a new instance of Axios
 *
 * @param {Object} instanceConfig The default config for the instance
 */
function Axios(instanceConfig) {
  this.defaults = instanceConfig;
  this.interceptors = {
    request: new InterceptorManager(),
    response: new InterceptorManager()
  };
}

/**
 * Dispatch a request
 *
 * @param {Object} config The config specific for this request (merged with this.defaults)
 */
Axios.prototype.request = function request(config) {
  /*eslint no-param-reassign:0*/
  // Allow for axios('example/url'[, config]) a la fetch API
  if (typeof config === 'string') {
    config = arguments[1] || {};
    config.url = arguments[0];
  } else {
    config = config || {};
  }

  config = mergeConfig(this.defaults, config);

  // Set config.method
  if (config.method) {
    config.method = config.method.toLowerCase();
  } else if (this.defaults.method) {
    config.method = this.defaults.method.toLowerCase();
  } else {
    config.method = 'get';
  }

  var transitional = config.transitional;

  if (transitional !== undefined) {
    validator.assertOptions(transitional, {
      silentJSONParsing: validators.transitional(validators.boolean),
      forcedJSONParsing: validators.transitional(validators.boolean),
      clarifyTimeoutError: validators.transitional(validators.boolean)
    }, false);
  }

  // filter out skipped interceptors
  var requestInterceptorChain = [];
  var synchronousRequestInterceptors = true;
  this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
    if (typeof interceptor.runWhen === 'function' && interceptor.runWhen(config) === false) {
      return;
    }

    synchronousRequestInterceptors = synchronousRequestInterceptors && interceptor.synchronous;

    requestInterceptorChain.unshift(interceptor.fulfilled, interceptor.rejected);
  });

  var responseInterceptorChain = [];
  this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
    responseInterceptorChain.push(interceptor.fulfilled, interceptor.rejected);
  });

  var promise;

  if (!synchronousRequestInterceptors) {
    var chain = [dispatchRequest, undefined];

    Array.prototype.unshift.apply(chain, requestInterceptorChain);
    chain = chain.concat(responseInterceptorChain);

    promise = Promise.resolve(config);
    while (chain.length) {
      promise = promise.then(chain.shift(), chain.shift());
    }

    return promise;
  }


  var newConfig = config;
  while (requestInterceptorChain.length) {
    var onFulfilled = requestInterceptorChain.shift();
    var onRejected = requestInterceptorChain.shift();
    try {
      newConfig = onFulfilled(newConfig);
    } catch (error) {
      onRejected(error);
      break;
    }
  }

  try {
    promise = dispatchRequest(newConfig);
  } catch (error) {
    return Promise.reject(error);
  }

  while (responseInterceptorChain.length) {
    promise = promise.then(responseInterceptorChain.shift(), responseInterceptorChain.shift());
  }

  return promise;
};

Axios.prototype.getUri = function getUri(config) {
  config = mergeConfig(this.defaults, config);
  return buildURL(config.url, config.params, config.paramsSerializer).replace(/^\?/, '');
};

// Provide aliases for supported request methods
utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, config) {
    return this.request(mergeConfig(config || {}, {
      method: method,
      url: url,
      data: (config || {}).data
    }));
  };
});

utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, data, config) {
    return this.request(mergeConfig(config || {}, {
      method: method,
      url: url,
      data: data
    }));
  };
});

module.exports = Axios;

},{"../helpers/buildURL":20,"../helpers/validator":29,"./../utils":30,"./InterceptorManager":9,"./dispatchRequest":12,"./mergeConfig":14}],9:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

function InterceptorManager() {
  this.handlers = [];
}

/**
 * Add a new interceptor to the stack
 *
 * @param {Function} fulfilled The function to handle `then` for a `Promise`
 * @param {Function} rejected The function to handle `reject` for a `Promise`
 *
 * @return {Number} An ID used to remove interceptor later
 */
InterceptorManager.prototype.use = function use(fulfilled, rejected, options) {
  this.handlers.push({
    fulfilled: fulfilled,
    rejected: rejected,
    synchronous: options ? options.synchronous : false,
    runWhen: options ? options.runWhen : null
  });
  return this.handlers.length - 1;
};

/**
 * Remove an interceptor from the stack
 *
 * @param {Number} id The ID that was returned by `use`
 */
InterceptorManager.prototype.eject = function eject(id) {
  if (this.handlers[id]) {
    this.handlers[id] = null;
  }
};

/**
 * Iterate over all the registered interceptors
 *
 * This method is particularly useful for skipping over any
 * interceptors that may have become `null` calling `eject`.
 *
 * @param {Function} fn The function to call for each interceptor
 */
InterceptorManager.prototype.forEach = function forEach(fn) {
  utils.forEach(this.handlers, function forEachHandler(h) {
    if (h !== null) {
      fn(h);
    }
  });
};

module.exports = InterceptorManager;

},{"./../utils":30}],10:[function(require,module,exports){
'use strict';

var isAbsoluteURL = require('../helpers/isAbsoluteURL');
var combineURLs = require('../helpers/combineURLs');

/**
 * Creates a new URL by combining the baseURL with the requestedURL,
 * only when the requestedURL is not already an absolute URL.
 * If the requestURL is absolute, this function returns the requestedURL untouched.
 *
 * @param {string} baseURL The base URL
 * @param {string} requestedURL Absolute or relative URL to combine
 * @returns {string} The combined full path
 */
module.exports = function buildFullPath(baseURL, requestedURL) {
  if (baseURL && !isAbsoluteURL(requestedURL)) {
    return combineURLs(baseURL, requestedURL);
  }
  return requestedURL;
};

},{"../helpers/combineURLs":21,"../helpers/isAbsoluteURL":23}],11:[function(require,module,exports){
'use strict';

var enhanceError = require('./enhanceError');

/**
 * Create an Error with the specified message, config, error code, request and response.
 *
 * @param {string} message The error message.
 * @param {Object} config The config.
 * @param {string} [code] The error code (for example, 'ECONNABORTED').
 * @param {Object} [request] The request.
 * @param {Object} [response] The response.
 * @returns {Error} The created error.
 */
module.exports = function createError(message, config, code, request, response) {
  var error = new Error(message);
  return enhanceError(error, config, code, request, response);
};

},{"./enhanceError":13}],12:[function(require,module,exports){
'use strict';

var utils = require('./../utils');
var transformData = require('./transformData');
var isCancel = require('../cancel/isCancel');
var defaults = require('../defaults');
var Cancel = require('../cancel/Cancel');

/**
 * Throws a `Cancel` if cancellation has been requested.
 */
function throwIfCancellationRequested(config) {
  if (config.cancelToken) {
    config.cancelToken.throwIfRequested();
  }

  if (config.signal && config.signal.aborted) {
    throw new Cancel('canceled');
  }
}

/**
 * Dispatch a request to the server using the configured adapter.
 *
 * @param {object} config The config that is to be used for the request
 * @returns {Promise} The Promise to be fulfilled
 */
module.exports = function dispatchRequest(config) {
  throwIfCancellationRequested(config);

  // Ensure headers exist
  config.headers = config.headers || {};

  // Transform request data
  config.data = transformData.call(
    config,
    config.data,
    config.headers,
    config.transformRequest
  );

  // Flatten headers
  config.headers = utils.merge(
    config.headers.common || {},
    config.headers[config.method] || {},
    config.headers
  );

  utils.forEach(
    ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
    function cleanHeaderConfig(method) {
      delete config.headers[method];
    }
  );

  var adapter = config.adapter || defaults.adapter;

  return adapter(config).then(function onAdapterResolution(response) {
    throwIfCancellationRequested(config);

    // Transform response data
    response.data = transformData.call(
      config,
      response.data,
      response.headers,
      config.transformResponse
    );

    return response;
  }, function onAdapterRejection(reason) {
    if (!isCancel(reason)) {
      throwIfCancellationRequested(config);

      // Transform response data
      if (reason && reason.response) {
        reason.response.data = transformData.call(
          config,
          reason.response.data,
          reason.response.headers,
          config.transformResponse
        );
      }
    }

    return Promise.reject(reason);
  });
};

},{"../cancel/Cancel":5,"../cancel/isCancel":7,"../defaults":17,"./../utils":30,"./transformData":16}],13:[function(require,module,exports){
'use strict';

/**
 * Update an Error with the specified config, error code, and response.
 *
 * @param {Error} error The error to update.
 * @param {Object} config The config.
 * @param {string} [code] The error code (for example, 'ECONNABORTED').
 * @param {Object} [request] The request.
 * @param {Object} [response] The response.
 * @returns {Error} The error.
 */
module.exports = function enhanceError(error, config, code, request, response) {
  error.config = config;
  if (code) {
    error.code = code;
  }

  error.request = request;
  error.response = response;
  error.isAxiosError = true;

  error.toJSON = function toJSON() {
    return {
      // Standard
      message: this.message,
      name: this.name,
      // Microsoft
      description: this.description,
      number: this.number,
      // Mozilla
      fileName: this.fileName,
      lineNumber: this.lineNumber,
      columnNumber: this.columnNumber,
      stack: this.stack,
      // Axios
      config: this.config,
      code: this.code,
      status: this.response && this.response.status ? this.response.status : null
    };
  };
  return error;
};

},{}],14:[function(require,module,exports){
'use strict';

var utils = require('../utils');

/**
 * Config-specific merge-function which creates a new config-object
 * by merging two configuration objects together.
 *
 * @param {Object} config1
 * @param {Object} config2
 * @returns {Object} New object resulting from merging config2 to config1
 */
module.exports = function mergeConfig(config1, config2) {
  // eslint-disable-next-line no-param-reassign
  config2 = config2 || {};
  var config = {};

  function getMergedValue(target, source) {
    if (utils.isPlainObject(target) && utils.isPlainObject(source)) {
      return utils.merge(target, source);
    } else if (utils.isPlainObject(source)) {
      return utils.merge({}, source);
    } else if (utils.isArray(source)) {
      return source.slice();
    }
    return source;
  }

  // eslint-disable-next-line consistent-return
  function mergeDeepProperties(prop) {
    if (!utils.isUndefined(config2[prop])) {
      return getMergedValue(config1[prop], config2[prop]);
    } else if (!utils.isUndefined(config1[prop])) {
      return getMergedValue(undefined, config1[prop]);
    }
  }

  // eslint-disable-next-line consistent-return
  function valueFromConfig2(prop) {
    if (!utils.isUndefined(config2[prop])) {
      return getMergedValue(undefined, config2[prop]);
    }
  }

  // eslint-disable-next-line consistent-return
  function defaultToConfig2(prop) {
    if (!utils.isUndefined(config2[prop])) {
      return getMergedValue(undefined, config2[prop]);
    } else if (!utils.isUndefined(config1[prop])) {
      return getMergedValue(undefined, config1[prop]);
    }
  }

  // eslint-disable-next-line consistent-return
  function mergeDirectKeys(prop) {
    if (prop in config2) {
      return getMergedValue(config1[prop], config2[prop]);
    } else if (prop in config1) {
      return getMergedValue(undefined, config1[prop]);
    }
  }

  var mergeMap = {
    'url': valueFromConfig2,
    'method': valueFromConfig2,
    'data': valueFromConfig2,
    'baseURL': defaultToConfig2,
    'transformRequest': defaultToConfig2,
    'transformResponse': defaultToConfig2,
    'paramsSerializer': defaultToConfig2,
    'timeout': defaultToConfig2,
    'timeoutMessage': defaultToConfig2,
    'withCredentials': defaultToConfig2,
    'adapter': defaultToConfig2,
    'responseType': defaultToConfig2,
    'xsrfCookieName': defaultToConfig2,
    'xsrfHeaderName': defaultToConfig2,
    'onUploadProgress': defaultToConfig2,
    'onDownloadProgress': defaultToConfig2,
    'decompress': defaultToConfig2,
    'maxContentLength': defaultToConfig2,
    'maxBodyLength': defaultToConfig2,
    'transport': defaultToConfig2,
    'httpAgent': defaultToConfig2,
    'httpsAgent': defaultToConfig2,
    'cancelToken': defaultToConfig2,
    'socketPath': defaultToConfig2,
    'responseEncoding': defaultToConfig2,
    'validateStatus': mergeDirectKeys
  };

  utils.forEach(Object.keys(config1).concat(Object.keys(config2)), function computeConfigValue(prop) {
    var merge = mergeMap[prop] || mergeDeepProperties;
    var configValue = merge(prop);
    (utils.isUndefined(configValue) && merge !== mergeDirectKeys) || (config[prop] = configValue);
  });

  return config;
};

},{"../utils":30}],15:[function(require,module,exports){
'use strict';

var createError = require('./createError');

/**
 * Resolve or reject a Promise based on response status.
 *
 * @param {Function} resolve A function that resolves the promise.
 * @param {Function} reject A function that rejects the promise.
 * @param {object} response The response.
 */
module.exports = function settle(resolve, reject, response) {
  var validateStatus = response.config.validateStatus;
  if (!response.status || !validateStatus || validateStatus(response.status)) {
    resolve(response);
  } else {
    reject(createError(
      'Request failed with status code ' + response.status,
      response.config,
      null,
      response.request,
      response
    ));
  }
};

},{"./createError":11}],16:[function(require,module,exports){
'use strict';

var utils = require('./../utils');
var defaults = require('./../defaults');

/**
 * Transform the data for a request or a response
 *
 * @param {Object|String} data The data to be transformed
 * @param {Array} headers The headers for the request or response
 * @param {Array|Function} fns A single function or Array of functions
 * @returns {*} The resulting transformed data
 */
module.exports = function transformData(data, headers, fns) {
  var context = this || defaults;
  /*eslint no-param-reassign:0*/
  utils.forEach(fns, function transform(fn) {
    data = fn.call(context, data, headers);
  });

  return data;
};

},{"./../defaults":17,"./../utils":30}],17:[function(require,module,exports){
(function (process){(function (){
'use strict';

var utils = require('./utils');
var normalizeHeaderName = require('./helpers/normalizeHeaderName');
var enhanceError = require('./core/enhanceError');

var DEFAULT_CONTENT_TYPE = {
  'Content-Type': 'application/x-www-form-urlencoded'
};

function setContentTypeIfUnset(headers, value) {
  if (!utils.isUndefined(headers) && utils.isUndefined(headers['Content-Type'])) {
    headers['Content-Type'] = value;
  }
}

function getDefaultAdapter() {
  var adapter;
  if (typeof XMLHttpRequest !== 'undefined') {
    // For browsers use XHR adapter
    adapter = require('./adapters/xhr');
  } else if (typeof process !== 'undefined' && Object.prototype.toString.call(process) === '[object process]') {
    // For node use HTTP adapter
    adapter = require('./adapters/http');
  }
  return adapter;
}

function stringifySafely(rawValue, parser, encoder) {
  if (utils.isString(rawValue)) {
    try {
      (parser || JSON.parse)(rawValue);
      return utils.trim(rawValue);
    } catch (e) {
      if (e.name !== 'SyntaxError') {
        throw e;
      }
    }
  }

  return (encoder || JSON.stringify)(rawValue);
}

var defaults = {

  transitional: {
    silentJSONParsing: true,
    forcedJSONParsing: true,
    clarifyTimeoutError: false
  },

  adapter: getDefaultAdapter(),

  transformRequest: [function transformRequest(data, headers) {
    normalizeHeaderName(headers, 'Accept');
    normalizeHeaderName(headers, 'Content-Type');

    if (utils.isFormData(data) ||
      utils.isArrayBuffer(data) ||
      utils.isBuffer(data) ||
      utils.isStream(data) ||
      utils.isFile(data) ||
      utils.isBlob(data)
    ) {
      return data;
    }
    if (utils.isArrayBufferView(data)) {
      return data.buffer;
    }
    if (utils.isURLSearchParams(data)) {
      setContentTypeIfUnset(headers, 'application/x-www-form-urlencoded;charset=utf-8');
      return data.toString();
    }
    if (utils.isObject(data) || (headers && headers['Content-Type'] === 'application/json')) {
      setContentTypeIfUnset(headers, 'application/json');
      return stringifySafely(data);
    }
    return data;
  }],

  transformResponse: [function transformResponse(data) {
    var transitional = this.transitional || defaults.transitional;
    var silentJSONParsing = transitional && transitional.silentJSONParsing;
    var forcedJSONParsing = transitional && transitional.forcedJSONParsing;
    var strictJSONParsing = !silentJSONParsing && this.responseType === 'json';

    if (strictJSONParsing || (forcedJSONParsing && utils.isString(data) && data.length)) {
      try {
        return JSON.parse(data);
      } catch (e) {
        if (strictJSONParsing) {
          if (e.name === 'SyntaxError') {
            throw enhanceError(e, this, 'E_JSON_PARSE');
          }
          throw e;
        }
      }
    }

    return data;
  }],

  /**
   * A timeout in milliseconds to abort a request. If set to 0 (default) a
   * timeout is not created.
   */
  timeout: 0,

  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',

  maxContentLength: -1,
  maxBodyLength: -1,

  validateStatus: function validateStatus(status) {
    return status >= 200 && status < 300;
  },

  headers: {
    common: {
      'Accept': 'application/json, text/plain, */*'
    }
  }
};

utils.forEach(['delete', 'get', 'head'], function forEachMethodNoData(method) {
  defaults.headers[method] = {};
});

utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  defaults.headers[method] = utils.merge(DEFAULT_CONTENT_TYPE);
});

module.exports = defaults;

}).call(this)}).call(this,require('_process'))
},{"./adapters/http":3,"./adapters/xhr":3,"./core/enhanceError":13,"./helpers/normalizeHeaderName":26,"./utils":30,"_process":61}],18:[function(require,module,exports){
module.exports = {
  "version": "0.24.0"
};
},{}],19:[function(require,module,exports){
'use strict';

module.exports = function bind(fn, thisArg) {
  return function wrap() {
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }
    return fn.apply(thisArg, args);
  };
};

},{}],20:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

function encode(val) {
  return encodeURIComponent(val).
    replace(/%3A/gi, ':').
    replace(/%24/g, '$').
    replace(/%2C/gi, ',').
    replace(/%20/g, '+').
    replace(/%5B/gi, '[').
    replace(/%5D/gi, ']');
}

/**
 * Build a URL by appending params to the end
 *
 * @param {string} url The base of the url (e.g., http://www.google.com)
 * @param {object} [params] The params to be appended
 * @returns {string} The formatted url
 */
module.exports = function buildURL(url, params, paramsSerializer) {
  /*eslint no-param-reassign:0*/
  if (!params) {
    return url;
  }

  var serializedParams;
  if (paramsSerializer) {
    serializedParams = paramsSerializer(params);
  } else if (utils.isURLSearchParams(params)) {
    serializedParams = params.toString();
  } else {
    var parts = [];

    utils.forEach(params, function serialize(val, key) {
      if (val === null || typeof val === 'undefined') {
        return;
      }

      if (utils.isArray(val)) {
        key = key + '[]';
      } else {
        val = [val];
      }

      utils.forEach(val, function parseValue(v) {
        if (utils.isDate(v)) {
          v = v.toISOString();
        } else if (utils.isObject(v)) {
          v = JSON.stringify(v);
        }
        parts.push(encode(key) + '=' + encode(v));
      });
    });

    serializedParams = parts.join('&');
  }

  if (serializedParams) {
    var hashmarkIndex = url.indexOf('#');
    if (hashmarkIndex !== -1) {
      url = url.slice(0, hashmarkIndex);
    }

    url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
  }

  return url;
};

},{"./../utils":30}],21:[function(require,module,exports){
'use strict';

/**
 * Creates a new URL by combining the specified URLs
 *
 * @param {string} baseURL The base URL
 * @param {string} relativeURL The relative URL
 * @returns {string} The combined URL
 */
module.exports = function combineURLs(baseURL, relativeURL) {
  return relativeURL
    ? baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '')
    : baseURL;
};

},{}],22:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

module.exports = (
  utils.isStandardBrowserEnv() ?

  // Standard browser envs support document.cookie
    (function standardBrowserEnv() {
      return {
        write: function write(name, value, expires, path, domain, secure) {
          var cookie = [];
          cookie.push(name + '=' + encodeURIComponent(value));

          if (utils.isNumber(expires)) {
            cookie.push('expires=' + new Date(expires).toGMTString());
          }

          if (utils.isString(path)) {
            cookie.push('path=' + path);
          }

          if (utils.isString(domain)) {
            cookie.push('domain=' + domain);
          }

          if (secure === true) {
            cookie.push('secure');
          }

          document.cookie = cookie.join('; ');
        },

        read: function read(name) {
          var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
          return (match ? decodeURIComponent(match[3]) : null);
        },

        remove: function remove(name) {
          this.write(name, '', Date.now() - 86400000);
        }
      };
    })() :

  // Non standard browser env (web workers, react-native) lack needed support.
    (function nonStandardBrowserEnv() {
      return {
        write: function write() {},
        read: function read() { return null; },
        remove: function remove() {}
      };
    })()
);

},{"./../utils":30}],23:[function(require,module,exports){
'use strict';

/**
 * Determines whether the specified URL is absolute
 *
 * @param {string} url The URL to test
 * @returns {boolean} True if the specified URL is absolute, otherwise false
 */
module.exports = function isAbsoluteURL(url) {
  // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
  // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
  // by any combination of letters, digits, plus, period, or hyphen.
  return /^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(url);
};

},{}],24:[function(require,module,exports){
'use strict';

/**
 * Determines whether the payload is an error thrown by Axios
 *
 * @param {*} payload The value to test
 * @returns {boolean} True if the payload is an error thrown by Axios, otherwise false
 */
module.exports = function isAxiosError(payload) {
  return (typeof payload === 'object') && (payload.isAxiosError === true);
};

},{}],25:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

module.exports = (
  utils.isStandardBrowserEnv() ?

  // Standard browser envs have full support of the APIs needed to test
  // whether the request URL is of the same origin as current location.
    (function standardBrowserEnv() {
      var msie = /(msie|trident)/i.test(navigator.userAgent);
      var urlParsingNode = document.createElement('a');
      var originURL;

      /**
    * Parse a URL to discover it's components
    *
    * @param {String} url The URL to be parsed
    * @returns {Object}
    */
      function resolveURL(url) {
        var href = url;

        if (msie) {
        // IE needs attribute set twice to normalize properties
          urlParsingNode.setAttribute('href', href);
          href = urlParsingNode.href;
        }

        urlParsingNode.setAttribute('href', href);

        // urlParsingNode provides the UrlUtils interface - http://url.spec.whatwg.org/#urlutils
        return {
          href: urlParsingNode.href,
          protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
          host: urlParsingNode.host,
          search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
          hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
          hostname: urlParsingNode.hostname,
          port: urlParsingNode.port,
          pathname: (urlParsingNode.pathname.charAt(0) === '/') ?
            urlParsingNode.pathname :
            '/' + urlParsingNode.pathname
        };
      }

      originURL = resolveURL(window.location.href);

      /**
    * Determine if a URL shares the same origin as the current location
    *
    * @param {String} requestURL The URL to test
    * @returns {boolean} True if URL shares the same origin, otherwise false
    */
      return function isURLSameOrigin(requestURL) {
        var parsed = (utils.isString(requestURL)) ? resolveURL(requestURL) : requestURL;
        return (parsed.protocol === originURL.protocol &&
            parsed.host === originURL.host);
      };
    })() :

  // Non standard browser envs (web workers, react-native) lack needed support.
    (function nonStandardBrowserEnv() {
      return function isURLSameOrigin() {
        return true;
      };
    })()
);

},{"./../utils":30}],26:[function(require,module,exports){
'use strict';

var utils = require('../utils');

module.exports = function normalizeHeaderName(headers, normalizedName) {
  utils.forEach(headers, function processHeader(value, name) {
    if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) {
      headers[normalizedName] = value;
      delete headers[name];
    }
  });
};

},{"../utils":30}],27:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

// Headers whose duplicates are ignored by node
// c.f. https://nodejs.org/api/http.html#http_message_headers
var ignoreDuplicateOf = [
  'age', 'authorization', 'content-length', 'content-type', 'etag',
  'expires', 'from', 'host', 'if-modified-since', 'if-unmodified-since',
  'last-modified', 'location', 'max-forwards', 'proxy-authorization',
  'referer', 'retry-after', 'user-agent'
];

/**
 * Parse headers into an object
 *
 * ```
 * Date: Wed, 27 Aug 2014 08:58:49 GMT
 * Content-Type: application/json
 * Connection: keep-alive
 * Transfer-Encoding: chunked
 * ```
 *
 * @param {String} headers Headers needing to be parsed
 * @returns {Object} Headers parsed into an object
 */
module.exports = function parseHeaders(headers) {
  var parsed = {};
  var key;
  var val;
  var i;

  if (!headers) { return parsed; }

  utils.forEach(headers.split('\n'), function parser(line) {
    i = line.indexOf(':');
    key = utils.trim(line.substr(0, i)).toLowerCase();
    val = utils.trim(line.substr(i + 1));

    if (key) {
      if (parsed[key] && ignoreDuplicateOf.indexOf(key) >= 0) {
        return;
      }
      if (key === 'set-cookie') {
        parsed[key] = (parsed[key] ? parsed[key] : []).concat([val]);
      } else {
        parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
      }
    }
  });

  return parsed;
};

},{"./../utils":30}],28:[function(require,module,exports){
'use strict';

/**
 * Syntactic sugar for invoking a function and expanding an array for arguments.
 *
 * Common use case would be to use `Function.prototype.apply`.
 *
 *  ```js
 *  function f(x, y, z) {}
 *  var args = [1, 2, 3];
 *  f.apply(null, args);
 *  ```
 *
 * With `spread` this example can be re-written.
 *
 *  ```js
 *  spread(function(x, y, z) {})([1, 2, 3]);
 *  ```
 *
 * @param {Function} callback
 * @returns {Function}
 */
module.exports = function spread(callback) {
  return function wrap(arr) {
    return callback.apply(null, arr);
  };
};

},{}],29:[function(require,module,exports){
'use strict';

var VERSION = require('../env/data').version;

var validators = {};

// eslint-disable-next-line func-names
['object', 'boolean', 'number', 'function', 'string', 'symbol'].forEach(function(type, i) {
  validators[type] = function validator(thing) {
    return typeof thing === type || 'a' + (i < 1 ? 'n ' : ' ') + type;
  };
});

var deprecatedWarnings = {};

/**
 * Transitional option validator
 * @param {function|boolean?} validator - set to false if the transitional option has been removed
 * @param {string?} version - deprecated version / removed since version
 * @param {string?} message - some message with additional info
 * @returns {function}
 */
validators.transitional = function transitional(validator, version, message) {
  function formatMessage(opt, desc) {
    return '[Axios v' + VERSION + '] Transitional option \'' + opt + '\'' + desc + (message ? '. ' + message : '');
  }

  // eslint-disable-next-line func-names
  return function(value, opt, opts) {
    if (validator === false) {
      throw new Error(formatMessage(opt, ' has been removed' + (version ? ' in ' + version : '')));
    }

    if (version && !deprecatedWarnings[opt]) {
      deprecatedWarnings[opt] = true;
      // eslint-disable-next-line no-console
      console.warn(
        formatMessage(
          opt,
          ' has been deprecated since v' + version + ' and will be removed in the near future'
        )
      );
    }

    return validator ? validator(value, opt, opts) : true;
  };
};

/**
 * Assert object's properties type
 * @param {object} options
 * @param {object} schema
 * @param {boolean?} allowUnknown
 */

function assertOptions(options, schema, allowUnknown) {
  if (typeof options !== 'object') {
    throw new TypeError('options must be an object');
  }
  var keys = Object.keys(options);
  var i = keys.length;
  while (i-- > 0) {
    var opt = keys[i];
    var validator = schema[opt];
    if (validator) {
      var value = options[opt];
      var result = value === undefined || validator(value, opt, options);
      if (result !== true) {
        throw new TypeError('option ' + opt + ' must be ' + result);
      }
      continue;
    }
    if (allowUnknown !== true) {
      throw Error('Unknown option ' + opt);
    }
  }
}

module.exports = {
  assertOptions: assertOptions,
  validators: validators
};

},{"../env/data":18}],30:[function(require,module,exports){
'use strict';

var bind = require('./helpers/bind');

// utils is a library of generic helper functions non-specific to axios

var toString = Object.prototype.toString;

/**
 * Determine if a value is an Array
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an Array, otherwise false
 */
function isArray(val) {
  return toString.call(val) === '[object Array]';
}

/**
 * Determine if a value is undefined
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if the value is undefined, otherwise false
 */
function isUndefined(val) {
  return typeof val === 'undefined';
}

/**
 * Determine if a value is a Buffer
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Buffer, otherwise false
 */
function isBuffer(val) {
  return val !== null && !isUndefined(val) && val.constructor !== null && !isUndefined(val.constructor)
    && typeof val.constructor.isBuffer === 'function' && val.constructor.isBuffer(val);
}

/**
 * Determine if a value is an ArrayBuffer
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an ArrayBuffer, otherwise false
 */
function isArrayBuffer(val) {
  return toString.call(val) === '[object ArrayBuffer]';
}

/**
 * Determine if a value is a FormData
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an FormData, otherwise false
 */
function isFormData(val) {
  return (typeof FormData !== 'undefined') && (val instanceof FormData);
}

/**
 * Determine if a value is a view on an ArrayBuffer
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a view on an ArrayBuffer, otherwise false
 */
function isArrayBufferView(val) {
  var result;
  if ((typeof ArrayBuffer !== 'undefined') && (ArrayBuffer.isView)) {
    result = ArrayBuffer.isView(val);
  } else {
    result = (val) && (val.buffer) && (val.buffer instanceof ArrayBuffer);
  }
  return result;
}

/**
 * Determine if a value is a String
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a String, otherwise false
 */
function isString(val) {
  return typeof val === 'string';
}

/**
 * Determine if a value is a Number
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Number, otherwise false
 */
function isNumber(val) {
  return typeof val === 'number';
}

/**
 * Determine if a value is an Object
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an Object, otherwise false
 */
function isObject(val) {
  return val !== null && typeof val === 'object';
}

/**
 * Determine if a value is a plain Object
 *
 * @param {Object} val The value to test
 * @return {boolean} True if value is a plain Object, otherwise false
 */
function isPlainObject(val) {
  if (toString.call(val) !== '[object Object]') {
    return false;
  }

  var prototype = Object.getPrototypeOf(val);
  return prototype === null || prototype === Object.prototype;
}

/**
 * Determine if a value is a Date
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Date, otherwise false
 */
function isDate(val) {
  return toString.call(val) === '[object Date]';
}

/**
 * Determine if a value is a File
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a File, otherwise false
 */
function isFile(val) {
  return toString.call(val) === '[object File]';
}

/**
 * Determine if a value is a Blob
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Blob, otherwise false
 */
function isBlob(val) {
  return toString.call(val) === '[object Blob]';
}

/**
 * Determine if a value is a Function
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Function, otherwise false
 */
function isFunction(val) {
  return toString.call(val) === '[object Function]';
}

/**
 * Determine if a value is a Stream
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Stream, otherwise false
 */
function isStream(val) {
  return isObject(val) && isFunction(val.pipe);
}

/**
 * Determine if a value is a URLSearchParams object
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a URLSearchParams object, otherwise false
 */
function isURLSearchParams(val) {
  return typeof URLSearchParams !== 'undefined' && val instanceof URLSearchParams;
}

/**
 * Trim excess whitespace off the beginning and end of a string
 *
 * @param {String} str The String to trim
 * @returns {String} The String freed of excess whitespace
 */
function trim(str) {
  return str.trim ? str.trim() : str.replace(/^\s+|\s+$/g, '');
}

/**
 * Determine if we're running in a standard browser environment
 *
 * This allows axios to run in a web worker, and react-native.
 * Both environments support XMLHttpRequest, but not fully standard globals.
 *
 * web workers:
 *  typeof window -> undefined
 *  typeof document -> undefined
 *
 * react-native:
 *  navigator.product -> 'ReactNative'
 * nativescript
 *  navigator.product -> 'NativeScript' or 'NS'
 */
function isStandardBrowserEnv() {
  if (typeof navigator !== 'undefined' && (navigator.product === 'ReactNative' ||
                                           navigator.product === 'NativeScript' ||
                                           navigator.product === 'NS')) {
    return false;
  }
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined'
  );
}

/**
 * Iterate over an Array or an Object invoking a function for each item.
 *
 * If `obj` is an Array callback will be called passing
 * the value, index, and complete array for each item.
 *
 * If 'obj' is an Object callback will be called passing
 * the value, key, and complete object for each property.
 *
 * @param {Object|Array} obj The object to iterate
 * @param {Function} fn The callback to invoke for each item
 */
function forEach(obj, fn) {
  // Don't bother if no value provided
  if (obj === null || typeof obj === 'undefined') {
    return;
  }

  // Force an array if not already something iterable
  if (typeof obj !== 'object') {
    /*eslint no-param-reassign:0*/
    obj = [obj];
  }

  if (isArray(obj)) {
    // Iterate over array values
    for (var i = 0, l = obj.length; i < l; i++) {
      fn.call(null, obj[i], i, obj);
    }
  } else {
    // Iterate over object keys
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        fn.call(null, obj[key], key, obj);
      }
    }
  }
}

/**
 * Accepts varargs expecting each argument to be an object, then
 * immutably merges the properties of each object and returns result.
 *
 * When multiple objects contain the same key the later object in
 * the arguments list will take precedence.
 *
 * Example:
 *
 * ```js
 * var result = merge({foo: 123}, {foo: 456});
 * console.log(result.foo); // outputs 456
 * ```
 *
 * @param {Object} obj1 Object to merge
 * @returns {Object} Result of all merge properties
 */
function merge(/* obj1, obj2, obj3, ... */) {
  var result = {};
  function assignValue(val, key) {
    if (isPlainObject(result[key]) && isPlainObject(val)) {
      result[key] = merge(result[key], val);
    } else if (isPlainObject(val)) {
      result[key] = merge({}, val);
    } else if (isArray(val)) {
      result[key] = val.slice();
    } else {
      result[key] = val;
    }
  }

  for (var i = 0, l = arguments.length; i < l; i++) {
    forEach(arguments[i], assignValue);
  }
  return result;
}

/**
 * Extends object a by mutably adding to it the properties of object b.
 *
 * @param {Object} a The object to be extended
 * @param {Object} b The object to copy properties from
 * @param {Object} thisArg The object to bind function to
 * @return {Object} The resulting value of object a
 */
function extend(a, b, thisArg) {
  forEach(b, function assignValue(val, key) {
    if (thisArg && typeof val === 'function') {
      a[key] = bind(val, thisArg);
    } else {
      a[key] = val;
    }
  });
  return a;
}

/**
 * Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
 *
 * @param {string} content with BOM
 * @return {string} content value without BOM
 */
function stripBOM(content) {
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  return content;
}

module.exports = {
  isArray: isArray,
  isArrayBuffer: isArrayBuffer,
  isBuffer: isBuffer,
  isFormData: isFormData,
  isArrayBufferView: isArrayBufferView,
  isString: isString,
  isNumber: isNumber,
  isObject: isObject,
  isPlainObject: isPlainObject,
  isUndefined: isUndefined,
  isDate: isDate,
  isFile: isFile,
  isBlob: isBlob,
  isFunction: isFunction,
  isStream: isStream,
  isURLSearchParams: isURLSearchParams,
  isStandardBrowserEnv: isStandardBrowserEnv,
  forEach: forEach,
  merge: merge,
  extend: extend,
  trim: trim,
  stripBOM: stripBOM
};

},{"./helpers/bind":19}],31:[function(require,module,exports){
/*!
  * $script.js JS loader & dependency manager
  * https://github.com/ded/script.js
  * (c) Dustin Diaz 2014 | License MIT
  */

(function (name, definition) {
  if (typeof module != 'undefined' && module.exports) module.exports = definition()
  else if (typeof define == 'function' && define.amd) define(definition)
  else this[name] = definition()
})('$script', function () {
  var doc = document
    , head = doc.getElementsByTagName('head')[0]
    , s = 'string'
    , f = false
    , push = 'push'
    , readyState = 'readyState'
    , onreadystatechange = 'onreadystatechange'
    , list = {}
    , ids = {}
    , delay = {}
    , scripts = {}
    , scriptpath
    , urlArgs

  function every(ar, fn) {
    for (var i = 0, j = ar.length; i < j; ++i) if (!fn(ar[i])) return f
    return 1
  }
  function each(ar, fn) {
    every(ar, function (el) {
      fn(el)
      return 1
    })
  }

  function $script(paths, idOrDone, optDone) {
    paths = paths[push] ? paths : [paths]
    var idOrDoneIsDone = idOrDone && idOrDone.call
      , done = idOrDoneIsDone ? idOrDone : optDone
      , id = idOrDoneIsDone ? paths.join('') : idOrDone
      , queue = paths.length
    function loopFn(item) {
      return item.call ? item() : list[item]
    }
    function callback() {
      if (!--queue) {
        list[id] = 1
        done && done()
        for (var dset in delay) {
          every(dset.split('|'), loopFn) && !each(delay[dset], loopFn) && (delay[dset] = [])
        }
      }
    }
    setTimeout(function () {
      each(paths, function loading(path, force) {
        if (path === null) return callback()
        
        if (!force && !/^https?:\/\//.test(path) && scriptpath) {
          path = (path.indexOf('.js') === -1) ? scriptpath + path + '.js' : scriptpath + path;
        }
        
        if (scripts[path]) {
          if (id) ids[id] = 1
          return (scripts[path] == 2) ? callback() : setTimeout(function () { loading(path, true) }, 0)
        }

        scripts[path] = 1
        if (id) ids[id] = 1
        create(path, callback)
      })
    }, 0)
    return $script
  }

  function create(path, fn) {
    var el = doc.createElement('script'), loaded
    el.onload = el.onerror = el[onreadystatechange] = function () {
      if ((el[readyState] && !(/^c|loade/.test(el[readyState]))) || loaded) return;
      el.onload = el[onreadystatechange] = null
      loaded = 1
      scripts[path] = 2
      fn()
    }
    el.async = 1
    el.src = urlArgs ? path + (path.indexOf('?') === -1 ? '?' : '&') + urlArgs : path;
    head.insertBefore(el, head.lastChild)
  }

  $script.get = create

  $script.order = function (scripts, id, done) {
    (function callback(s) {
      s = scripts.shift()
      !scripts.length ? $script(s, id, done) : $script(s, callback)
    }())
  }

  $script.path = function (p) {
    scriptpath = p
  }
  $script.urlArgs = function (str) {
    urlArgs = str;
  }
  $script.ready = function (deps, ready, req) {
    deps = deps[push] ? deps : [deps]
    var missing = [];
    !each(deps, function (dep) {
      list[dep] || missing[push](dep);
    }) && every(deps, function (dep) {return list[dep]}) ?
      ready() : !function (key) {
      delay[key] = delay[key] || []
      delay[key][push](ready)
      req && req(missing)
    }(deps.join('|'))
    return $script
  }

  $script.done = function (idOrDone) {
    $script([null], idOrDone)
  }

  return $script
});

},{}],32:[function(require,module,exports){
const toDateObject = require('./wikibase_time_to_date_object')

const helpers = {}
helpers.isNumericId = id => /^[1-9][0-9]*$/.test(id)
helpers.isEntityId = id => /^((Q|P|L)[1-9][0-9]*|L[1-9][0-9]*-(F|S)[1-9][0-9]*)$/.test(id)
helpers.isEntitySchemaId = id => /^E[1-9][0-9]*$/.test(id)
helpers.isItemId = id => /^Q[1-9][0-9]*$/.test(id)
helpers.isPropertyId = id => /^P[1-9][0-9]*$/.test(id)
helpers.isLexemeId = id => /^L[1-9][0-9]*$/.test(id)
helpers.isFormId = id => /^L[1-9][0-9]*-F[1-9][0-9]*$/.test(id)
helpers.isSenseId = id => /^L[1-9][0-9]*-S[1-9][0-9]*$/.test(id)
helpers.isGuid = guid => /^((Q|P|L)[1-9][0-9]*|L[1-9][0-9]*-(F|S)[1-9][0-9]*)\$[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(guid)
helpers.isHash = hash => /^[0-9a-f]{40}$/.test(hash)
helpers.isPropertyClaimsId = id => {
  const [ entityId, propertyId ] = id.split('#')
  return helpers.isEntityId(entityId) && helpers.isPropertyId(propertyId)
}
helpers.isRevisionId = id => /^\d+$/.test(id)

helpers.isEntityPageTitle = title => {
  if (typeof title !== 'string') return false
  let [ namespace, id ] = title.split(':')
  if (namespace && id) {
    return isEntityNamespace(namespace) && helpers[`is${namespace}Id`](id)
  } else {
    id = namespace
    return helpers.isItemId(id)
  }
}

const entityNamespaces = [ 'Item', 'Property', 'Lexeme' ]

const isEntityNamespace = str => entityNamespaces.includes(str)

const isNonNestedEntityId = id => /^(Q|P|L)[1-9][0-9]*$/.test(id)

helpers.getNumericId = id => {
  if (!isNonNestedEntityId(id)) throw new Error(`invalid entity id: ${id}`)
  return id.replace(/^(Q|P|L)/, '')
}

helpers.wikibaseTimeToDateObject = toDateObject

// Try to parse the date or return the input
const bestEffort = fn => value => {
  try {
    return fn(value)
  } catch (err) {
    value = value.time || value

    const sign = value[0]
    let [ yearMonthDay, withinDay ] = value.slice(1).split('T')
    yearMonthDay = yearMonthDay.replace(/-00/g, '-01')

    return `${sign}${yearMonthDay}T${withinDay}`
  }
}

const toEpochTime = wikibaseTime => toDateObject(wikibaseTime).getTime()
const toISOString = wikibaseTime => toDateObject(wikibaseTime).toISOString()

// A date format that knows just three precisions:
// 'yyyy', 'yyyy-mm', and 'yyyy-mm-dd' (including negative and non-4 digit years)
// Should be able to handle the old and the new Wikidata time:
// - in the old one, units below the precision where set to 00
// - in the new one, those months and days are set to 01 in those cases,
//   so when we can access the full claim object, we check the precision
//   to recover the old format
const toSimpleDay = wikibaseTime => {
  // Also accept claim datavalue.value objects, and actually prefer those,
  // as we can check the precision
  if (typeof wikibaseTime === 'object') {
    const { time, precision } = wikibaseTime
    // Year precision
    if (precision === 9) wikibaseTime = time.replace('-01-01T', '-00-00T')
    // Month precision
    else if (precision === 10) wikibaseTime = time.replace('-01T', '-00T')
    else wikibaseTime = time
  }

  return wikibaseTime.split('T')[0]
  // Remove positive years sign
  .replace(/^\+/, '')
  // Remove years padding zeros
  .replace(/^(-?)0+/, '$1')
  // Remove days if not included in the Wikidata date precision
  .replace(/-00$/, '')
  // Remove months if not included in the Wikidata date precision
  .replace(/-00$/, '')
}

helpers.wikibaseTimeToEpochTime = bestEffort(toEpochTime)
helpers.wikibaseTimeToISOString = bestEffort(toISOString)
helpers.wikibaseTimeToSimpleDay = bestEffort(toSimpleDay)

helpers.getImageUrl = (filename, width) => {
  let url = `https://commons.wikimedia.org/wiki/Special:FilePath/${filename}`
  if (typeof width === 'number') url += `?width=${width}`
  return url
}

helpers.getEntityIdFromGuid = guid => {
  const parts = guid.split(/[$-]/)
  if (parts.length === 6) {
    // Examples:
    // - q520$BCA8D9DE-B467-473B-943C-6FD0C5B3D02C
    // - P6216-a7fd6230-496e-6b47-ca4a-dcec5dbd7f95
    return parts[0].toUpperCase()
  } else if (parts.length === 7) {
    // Examples:
    // - L525-S1$66D20252-8CEC-4DB1-8B00-D713CFF42E48
    // - L525-F2-52c9b382-02f5-4413-9923-26ade74f5a0d
    return parts.slice(0, 2).join('-').toUpperCase()
  } else {
    throw new Error(`invalid guid: ${guid}`)
  }
}

module.exports = helpers

},{"./wikibase_time_to_date_object":47}],33:[function(require,module,exports){
const { wikibaseTimeToISOString, wikibaseTimeToEpochTime, wikibaseTimeToSimpleDay } = require('./helpers')

const simple = datavalue => datavalue.value

const monolingualtext = (datavalue, options) => {
  return options.keepRichValues ? datavalue.value : datavalue.value.text
}

const entity = (datavalue, options) => prefixedId(datavalue, options.entityPrefix)

const entityLetter = {
  item: 'Q',
  lexeme: 'L',
  property: 'P'
}

const prefixedId = (datavalue, prefix) => {
  const { value } = datavalue
  const id = value.id || entityLetter[value['entity-type']] + value['numeric-id']
  return typeof prefix === 'string' ? `${prefix}:${id}` : id
}

const quantity = (datavalue, options) => {
  const { value } = datavalue
  const amount = parseFloat(value.amount)
  if (options.keepRichValues) {
    const richValue = {
      amount: parseFloat(value.amount),
      // ex: http://www.wikidata.org/entity/
      unit: value.unit.replace(/^https?:\/\/.*\/entity\//, '')
    }
    if (value.upperBound != null) richValue.upperBound = parseFloat(value.upperBound)
    if (value.lowerBound != null) richValue.lowerBound = parseFloat(value.lowerBound)
    return richValue
  } else {
    return amount
  }
}

const coordinate = (datavalue, options) => {
  if (options.keepRichValues) {
    return datavalue.value
  } else {
    return [ datavalue.value.latitude, datavalue.value.longitude ]
  }
}

const time = (datavalue, options) => {
  let timeValue
  if (typeof options.timeConverter === 'function') {
    timeValue = options.timeConverter(datavalue.value)
  } else {
    timeValue = getTimeConverter(options.timeConverter)(datavalue.value)
  }
  if (options.keepRichValues) {
    const { timezone, before, after, precision, calendarmodel } = datavalue.value
    return { time: timeValue, timezone, before, after, precision, calendarmodel }
  } else {
    return timeValue
  }
}

const getTimeConverter = (key = 'iso') => {
  const converter = timeConverters[key]
  if (!converter) throw new Error(`invalid converter key: ${JSON.stringify(key).substring(0, 100)}`)
  return converter
}

// Each time converter should be able to accept 2 keys of arguments:
// - either datavalue.value objects (prefered as it gives access to the precision)
// - or the time string (datavalue.value.time)
const timeConverters = {
  iso: wikibaseTimeToISOString,
  epoch: wikibaseTimeToEpochTime,
  'simple-day': wikibaseTimeToSimpleDay,
  none: wikibaseTime => wikibaseTime.time || wikibaseTime
}

const parsers = {
  commonsMedia: simple,
  'external-id': simple,
  'geo-shape': simple,
  'globe-coordinate': coordinate,
  math: simple,
  monolingualtext,
  'musical-notation': simple,
  quantity,
  string: simple,
  'tabular-data': simple,
  time,
  url: simple,
  'wikibase-entityid': entity,
  'wikibase-form': entity,
  'wikibase-item': entity,
  'wikibase-lexeme': entity,
  'wikibase-property': entity,
  'wikibase-sense': entity
}

module.exports = {
  parsers,
  parse: (datatype, datavalue, options, claimId) => {
    // Known case of missing datatype: form.claims, sense.claims
    datatype = datatype || datavalue.type
    // Known case requiring this: legacy "muscial notation" datatype
    datatype = datatype.replace(' ', '-')

    try {
      return parsers[datatype](datavalue, options)
    } catch (err) {
      if (err.message === 'parsers[datatype] is not a function') {
        err.message = `${datatype} claim parser isn't implemented
        Claim id: ${claimId}
        Please report to https://github.com/maxlath/wikibase-sdk/issues`
      }
      throw err
    }
  }
}

},{"./helpers":32}],34:[function(require,module,exports){
const { simplifyEntity } = require('./simplify_entity')

const wb = {
  entities: res => {
    // Legacy convenience for the time the 'request' lib was all the rage
    res = res.body || res
    const { entities } = res
    Object.keys(entities).forEach(entityId => {
      entities[entityId] = simplifyEntity(entities[entityId])
    })
    return entities
  },

  pagesTitles: res => {
    // Same behavior as above
    res = res.body || res
    return res.query.search.map(result => result.title)
  }
}

module.exports = {
  wb,
  // Legacy
  wd: wb
}

},{"./simplify_entity":38}],35:[function(require,module,exports){
const truthyPropertyClaims = propClaims => {
  const aggregate = propClaims.reduce(aggregatePerRank, {})
  // on truthyness: https://www.mediawiki.org/wiki/Wikibase/Indexing/RDF_Dump_Format#Truthy_statements
  return aggregate.preferred || aggregate.normal || []
}

const nonDeprecatedPropertyClaims = propClaims => {
  return propClaims.filter(claim => claim.rank !== 'deprecated')
}

const aggregatePerRank = (aggregate, claim) => {
  const { rank } = claim
  aggregate[rank] || (aggregate[rank] = [])
  aggregate[rank].push(claim)
  return aggregate
}

const truthyClaims = claims => {
  const truthClaimsOnly = {}
  Object.keys(claims).forEach(property => {
    truthClaimsOnly[property] = truthyPropertyClaims(claims[property])
  })
  return truthClaimsOnly
}

module.exports = { truthyClaims, truthyPropertyClaims, nonDeprecatedPropertyClaims }

},{}],36:[function(require,module,exports){
const { labels, descriptions, aliases, lemmas, glosses } = require('./simplify_text_attributes')

const {
  simplifyClaim: claim,
  simplifyPropertyClaims: propertyClaims,
  simplifyClaims: claims,
  simplifyQualifier: qualifier,
  simplifyPropertyQualifiers: propertyQualifiers,
  simplifyQualifiers: qualifiers,
  simplifyReferences: references,
} = require('./simplify_claims')

const { simplifyForm: form, simplifyForms: forms } = require('./simplify_forms')
const { simplifySense: sense, simplifySenses: senses } = require('./simplify_senses')

const sitelinks = require('./simplify_sitelinks')
const sparqlResults = require('./simplify_sparql_results')

module.exports = {
  labels,
  descriptions,
  aliases,
  claim,
  propertyClaims,
  claims,
  qualifier,
  propertyQualifiers,
  qualifiers,
  references,
  sitelinks,

  // Aliases
  snak: claim,
  propertySnaks: propertyClaims,
  snaks: claims,

  // Lexemes
  lemmas,
  glosses,
  form,
  forms,
  sense,
  senses,

  sparqlResults

  // Set in ./simplify_entity
  // entity,
  // entities,
}

},{"./simplify_claims":37,"./simplify_forms":39,"./simplify_senses":40,"./simplify_sitelinks":41,"./simplify_sparql_results":42,"./simplify_text_attributes":43}],37:[function(require,module,exports){
const { parse: parseClaim } = require('./parse_claim')
const { uniq } = require('../utils/utils')
const { truthyPropertyClaims, nonDeprecatedPropertyClaims } = require('./rank')

// Expects an entity 'claims' object
// Ex: entity.claims
const simplifyClaims = (claims, ...options) => {
  const { propertyPrefix } = parseOptions(options)
  const simpleClaims = {}
  for (let id in claims) {
    const propClaims = claims[id]
    if (propertyPrefix) {
      id = propertyPrefix + ':' + id
    }
    simpleClaims[id] = simplifyPropertyClaims(propClaims, ...options)
  }
  return simpleClaims
}

// Expects the 'claims' array of a particular property
// Ex: entity.claims.P369
const simplifyPropertyClaims = (propClaims, ...options) => {
  // Avoid to throw on empty inputs to allow to simplify claims array
  // without having to know if the entity as claims for this property
  // Ex: simplifyPropertyClaims(entity.claims.P124211616)
  if (propClaims == null || propClaims.length === 0) return []

  const { keepNonTruthy, keepNonDeprecated, areSubSnaks } = parseOptions(options)

  if (keepNonDeprecated) {
    propClaims = nonDeprecatedPropertyClaims(propClaims)
  } else if (!(keepNonTruthy || areSubSnaks)) {
    propClaims = truthyPropertyClaims(propClaims)
  }

  propClaims = propClaims
    .map(claim => simplifyClaim(claim, ...options))
    // Filter-out novalue and somevalue claims,
    // unless a novalueValue or a somevalueValue is passed in options
    .filter(defined)

  // Deduplicate values unless we return a rich value object
  if (propClaims[0] && typeof propClaims[0] !== 'object') {
    return uniq(propClaims)
  } else {
    return propClaims
  }
}

// Considers null as defined
const defined = obj => obj !== undefined

// Expects a single claim object
// Ex: entity.claims.P369[0]
const simplifyClaim = (claim, ...options) => {
  options = parseOptions(options)
  const { keepQualifiers, keepReferences, keepIds, keepHashes, keepTypes, keepSnaktypes, keepRanks } = parseKeepOptions(options)

  // tries to replace wikidata deep claim object by a simple value
  // e.g. a string, an entity Qid or an epoch time number
  const { mainsnak, rank } = claim

  let value, datatype, datavalue, snaktype, isQualifierSnak, isReferenceSnak
  if (mainsnak) {
    datatype = mainsnak.datatype
    datavalue = mainsnak.datavalue
    snaktype = mainsnak.snaktype
  } else {
    // Qualifiers have no mainsnak, and define datatype, datavalue on claim
    datavalue = claim.datavalue
    datatype = claim.datatype
    snaktype = claim.snaktype
    // Duck typing the sub-snak type
    if (claim.hash) isQualifierSnak = true
    else isReferenceSnak = true
  }

  if (datavalue) {
    value = parseClaim(datatype, datavalue, options, claim.id)
  } else {
    if (snaktype === 'somevalue') value = options.somevalueValue
    else if (snaktype === 'novalue') value = options.novalueValue
    else throw new Error('no datavalue or special snaktype found')
  }

  // Qualifiers should not attempt to keep sub-qualifiers or references
  if (isQualifierSnak) {
    if (!(keepHashes || keepTypes || keepSnaktypes)) return value

    const valueObj = { value }

    if (keepHashes) valueObj.hash = claim.hash
    if (keepTypes) valueObj.type = datatype
    if (keepSnaktypes) valueObj.snaktype = snaktype

    return valueObj
  }
  if (isReferenceSnak) {
    if (!keepTypes) return value

    return { type: datatype, value }
  }
  // No need to test keepHashes as it has no effect if neither
  // keepQualifiers or keepReferences is true
  if (!(keepQualifiers || keepReferences || keepIds || keepTypes || keepSnaktypes || keepRanks)) {
    return value
  }

  // When keeping qualifiers or references, the value becomes an object
  // instead of a direct value
  const valueObj = { value }

  if (keepTypes) valueObj.type = datatype

  if (keepSnaktypes) valueObj.snaktype = snaktype

  if (keepRanks) valueObj.rank = rank

  const subSnaksOptions = getSubSnakOptions(options)
  subSnaksOptions.keepHashes = keepHashes

  if (keepQualifiers) {
    valueObj.qualifiers = simplifyQualifiers(claim.qualifiers, subSnaksOptions)
  }

  if (keepReferences) {
    claim.references = claim.references || []
    valueObj.references = simplifyReferences(claim.references, subSnaksOptions)
  }

  if (keepIds) valueObj.id = claim.id

  return valueObj
}

const parseOptions = options => {
  if (options == null) return {}

  if (options[0] && typeof options[0] === 'object') return options[0]

  // Legacy interface
  const [ entityPrefix, propertyPrefix, keepQualifiers ] = options
  return { entityPrefix, propertyPrefix, keepQualifiers }
}

const simplifyQualifiers = (qualifiers, options) => {
  return simplifyClaims(qualifiers, getSubSnakOptions(options))
}

const simplifyPropertyQualifiers = (propertyQualifiers, options) => {
  return simplifyPropertyClaims(propertyQualifiers, getSubSnakOptions(options))
}

const simplifyReferences = (references, options) => {
  return references.map(refRecord => {
    return simplifyReferenceRecord(refRecord, options)
  })
}

const simplifyReferenceRecord = (refRecord, options) => {
  const subSnaksOptions = getSubSnakOptions(options)
  const snaks = simplifyClaims(refRecord.snaks, subSnaksOptions)
  if (subSnaksOptions.keepHashes) return { snaks, hash: refRecord.hash }
  else return snaks
}

const getSubSnakOptions = (options = {}) => {
  if (options.areSubSnaks) return options
  // Using a new object so that the original options object isn't modified
  else return Object.assign({}, options, { areSubSnaks: true })
}

const keepOptions = [ 'keepQualifiers', 'keepReferences', 'keepIds', 'keepHashes', 'keepTypes', 'keepSnaktypes', 'keepRanks', 'keepRichValues' ]

const parseKeepOptions = options => {
  if (options.keepAll) {
    keepOptions.forEach(optionName => {
      if (options[optionName] == null) options[optionName] = true
    })
  }
  return options
}

module.exports = {
  simplifyClaims,
  simplifyPropertyClaims,
  simplifyClaim,
  simplifyQualifiers,
  simplifyPropertyQualifiers,
  simplifyQualifier: simplifyClaim,
  simplifyReferences,
}

},{"../utils/utils":58,"./parse_claim":33,"./rank":35}],38:[function(require,module,exports){
const simplify = require('./simplify')

const simplifyEntity = (entity, options) => {
  const { type } = entity
  const simplified = {
    id: entity.id,
    type,
    modified: entity.modified
  }

  if (entity.datatype) simplified.datatype = entity.datatype

  if (type === 'item') {
    simplifyIfDefined(entity, simplified, 'labels')
    simplifyIfDefined(entity, simplified, 'descriptions')
    simplifyIfDefined(entity, simplified, 'aliases')
    simplifyIfDefined(entity, simplified, 'claims', options)
    simplifyIfDefined(entity, simplified, 'sitelinks', options)
  } else if (type === 'property') {
    simplified.datatype = entity.datatype
    simplifyIfDefined(entity, simplified, 'labels')
    simplifyIfDefined(entity, simplified, 'descriptions')
    simplifyIfDefined(entity, simplified, 'aliases')
    simplifyIfDefined(entity, simplified, 'claims', options)
  } else if (type === 'lexeme') {
    simplifyIfDefined(entity, simplified, 'lemmas')
    simplified.lexicalCategory = entity.lexicalCategory
    simplified.language = entity.language
    simplifyIfDefined(entity, simplified, 'claims', options)
    simplifyIfDefined(entity, simplified, 'forms', options)
    simplifyIfDefined(entity, simplified, 'senses', options)
  }

  return simplified
}

const simplifyIfDefined = (entity, simplified, attribute, options) => {
  if (entity[attribute] != null) {
    simplified[attribute] = simplify[attribute](entity[attribute], options)
  }
}

const simplifyEntities = (entities, options = {}) => {
  if (entities.entities) entities = entities.entities
  const { entityPrefix } = options
  return Object.keys(entities).reduce((obj, key) => {
    const entity = entities[key]
    if (entityPrefix) key = `${entityPrefix}:${key}`
    obj[key] = simplifyEntity(entity, options)
    return obj
  }, {})
}

// Set those here instead of in ./simplify to avoid a circular dependency
simplify.entity = simplifyEntity
simplify.entities = simplifyEntities

module.exports = { simplifyEntity, simplifyEntities }

},{"./simplify":36}],39:[function(require,module,exports){
const { isFormId } = require('./helpers')
const { representations: simplifyRepresentations } = require('./simplify_text_attributes')
const { simplifyClaims } = require('./simplify_claims')

const simplifyForm = (form, options) => {
  const { id, representations, grammaticalFeatures, claims } = form
  if (!isFormId(id)) throw new Error('invalid form object')
  return {
    id,
    representations: simplifyRepresentations(representations),
    grammaticalFeatures,
    claims: simplifyClaims(claims, options)
  }
}

const simplifyForms = (forms, options) => forms.map(form => simplifyForm(form, options))

module.exports = { simplifyForm, simplifyForms }

},{"./helpers":32,"./simplify_claims":37,"./simplify_text_attributes":43}],40:[function(require,module,exports){
const { isSenseId } = require('./helpers')
const { glosses: simplifyGlosses } = require('./simplify_text_attributes')
const { simplifyClaims } = require('./simplify_claims')

const simplifySense = (sense, options) => {
  const { id, glosses, claims } = sense
  if (!isSenseId(id)) throw new Error('invalid sense object')
  return {
    id,
    glosses: simplifyGlosses(glosses),
    claims: simplifyClaims(claims, options)
  }
}

const simplifySenses = (senses, options) => senses.map(sense => simplifySense(sense, options))

module.exports = { simplifySense, simplifySenses }

},{"./helpers":32,"./simplify_claims":37,"./simplify_text_attributes":43}],41:[function(require,module,exports){
const { getSitelinkUrl } = require('./sitelinks')

module.exports = (sitelinks, options = {}) => {
  const { addUrl } = options
  return Object.keys(sitelinks).reduce(aggregateValues(sitelinks, addUrl), {})
}

const aggregateValues = (sitelinks, addUrl) => (index, key) => {
  // Accomodating for wikibase-cli, which might set the sitelink to null
  // to signify that a requested sitelink was not found
  if (sitelinks[key] == null) {
    index[key] = sitelinks[key]
    return index
  }
  const { title } = sitelinks[key]
  if (addUrl) {
    index[key] = { title, url: getSitelinkUrl(key, title) }
  } else {
    index[key] = title
  }
  return index
}

},{"./sitelinks":44}],42:[function(require,module,exports){
module.exports = (input, options = {}) => {
  if (typeof input === 'string') input = JSON.parse(input)

  const { vars } = input.head
  const results = input.results.bindings

  if (vars.length === 1 && options.minimize === true) {
    const varName = vars[0]
    return results
    .map(result => parseValue(result[varName]))
    // filtering-out bnodes
    .filter(result => result != null)
  }

  const { richVars, associatedVars, standaloneVars } = identifyVars(vars)
  return results.map(getSimplifiedResult(richVars, associatedVars, standaloneVars))
}

const parseValue = valueObj => {
  if (!(valueObj)) return
  let { datatype } = valueObj
  datatype = datatype && datatype.replace('http://www.w3.org/2001/XMLSchema#', '')
  const parser = parsers[valueObj.type] || getDatatypesParsers(datatype)
  return parser(valueObj)
}

const parsers = {
  uri: valueObj => parseUri(valueObj.value),
  // blank nodes will be filtered-out in order to get things simple
  bnode: () => null
}

const numberParser = valueObj => parseFloat(valueObj.value)

const getDatatypesParsers = datatype => {
  datatype = datatype && datatype.replace('http://www.w3.org/2001/XMLSchema#', '')
  return datatypesParsers[datatype] || passValue
}

const datatypesParsers = {
  decimal: numberParser,
  integer: numberParser,
  float: numberParser,
  double: numberParser,
  boolean: valueObj => valueObj.value === 'true'
}

// return the raw value if the datatype is missing
const passValue = valueObj => valueObj.value

const parseUri = uri => {
  // ex: http://www.wikidata.org/entity/statement/
  if (uri.match(/http.*\/entity\/statement\//)) {
    return convertStatementUriToGuid(uri)
  }

  return uri
  // ex: http://www.wikidata.org/entity/
  .replace(/^https?:\/\/.*\/entity\//, '')
  // ex: http://www.wikidata.org/prop/direct/
  .replace(/^https?:\/\/.*\/prop\/direct\//, '')
}

const convertStatementUriToGuid = uri => {
  // ex: http://www.wikidata.org/entity/statement/
  uri = uri.replace(/^https?:\/\/.*\/entity\/statement\//, '')
  const parts = uri.split('-')
  return parts[0] + '$' + parts.slice(1).join('-')
}

const identifyVars = vars => {
  const richVars = vars.filter(varName => vars.some(isAssociatedVar(varName)))
  const associatedVarPattern = new RegExp(`^(${richVars.join('|')})[A-Z]`)
  const associatedVars = vars.filter(varName => associatedVarPattern.test(varName))
  const standaloneVars = vars.filter(varName => {
    return !richVars.includes(varName) && !associatedVarPattern.test(varName)
  })
  return { richVars, associatedVars, standaloneVars }
}

const isAssociatedVar = varNameA => {
  const pattern = new RegExp(`^${varNameA}[A-Z]\\w+`)
  return pattern.test.bind(pattern)
}

const getSimplifiedResult = (richVars, associatedVars, standaloneVars) => result => {
  const simplifiedResult = {}
  for (const varName of richVars) {
    const richVarData = {}
    const value = parseValue(result[varName])
    if (value != null) richVarData.value = value
    for (const associatedVarName of associatedVars) {
      if (associatedVarName.startsWith(varName)) addAssociatedValue(result, varName, associatedVarName, richVarData)
    }
    if (Object.keys(richVarData).length > 0) simplifiedResult[varName] = richVarData
  }
  for (const varName of standaloneVars) {
    simplifiedResult[varName] = parseValue(result[varName])
  }
  return simplifiedResult
}

const addAssociatedValue = (result, varName, associatedVarName, richVarData) => {
  // ex: propertyType => Type
  let shortAssociatedVarName = associatedVarName.split(varName)[1]
  // ex: Type => type
  shortAssociatedVarName = shortAssociatedVarName[0].toLowerCase() + shortAssociatedVarName.slice(1)
  // ex: altLabel => aliases
  shortAssociatedVarName = specialNames[shortAssociatedVarName] || shortAssociatedVarName
  const associatedVarData = result[associatedVarName]
  if (associatedVarData != null) richVarData[shortAssociatedVarName] = associatedVarData.value
}

const specialNames = {
  altLabel: 'aliases'
}

},{}],43:[function(require,module,exports){
const simplifyTextAttributes = multivalue => data => {
  const simplified = {}
  Object.keys(data).forEach(lang => {
    const obj = data[lang]
    if (obj != null) {
      simplified[lang] = multivalue ? obj.map(getValue) : obj.value
    } else {
      simplified[lang] = multivalue ? [] : null
    }
  })
  return simplified
}

const getValue = obj => obj.value

const singleValue = simplifyTextAttributes(false)

module.exports = {
  labels: singleValue,
  descriptions: singleValue,
  aliases: simplifyTextAttributes(true),
  lemmas: singleValue,
  representations: singleValue,
  glosses: singleValue
}

},{}],44:[function(require,module,exports){
const { fixedEncodeURIComponent, replaceSpaceByUnderscores, isPlainObject } = require('../utils/utils')
const { isPropertyId } = require('./helpers')
const wikidataBase = 'https://www.wikidata.org/wiki/'
const languages = require('./sitelinks_languages')

const getSitelinkUrl = (site, title) => {
  if (isPlainObject(site)) {
    title = site.title
    site = site.site
  }

  if (!site) throw new Error('missing a site')
  if (!title) throw new Error('missing a title')

  const shortSiteKey = site.replace(/wiki$/, '')
  const specialUrlBuilder = siteUrlBuilders[shortSiteKey] || siteUrlBuilders[site]
  if (specialUrlBuilder) return specialUrlBuilder(title)

  const { lang, project } = getSitelinkData(site)
  title = fixedEncodeURIComponent(replaceSpaceByUnderscores(title))
  return `https://${lang}.${project}.org/wiki/${title}`
}

const wikimediaSite = subdomain => title => `https://${subdomain}.wikimedia.org/wiki/${title}`

const siteUrlBuilders = {
  commons: wikimediaSite('commons'),
  mediawiki: title => `https://www.mediawiki.org/wiki/${title}`,
  meta: wikimediaSite('meta'),
  species: wikimediaSite('species'),
  wikidata: title => {
    if (isPropertyId(title)) return `${wikidataBase}Property:${title}`
    return `${wikidataBase}${title}`
  },
  wikimania: wikimediaSite('wikimania')
}

const sitelinkUrlPattern = /^https?:\/\/([\w-]{2,10})\.(\w+)\.org\/\w+\/(.*)/

const getSitelinkData = site => {
  if (site.startsWith('http')) {
    const url = site
    const matchData = url.match(sitelinkUrlPattern)
    if (!matchData) throw new Error(`invalid sitelink url: ${url}`)
    let [ lang, project, title ] = matchData.slice(1)
    title = decodeURIComponent(title)
    let key
    // Known case: wikidata, mediawiki
    if (lang === 'www') {
      lang = 'en'
      key = project
    } else if (lang === 'commons') {
      lang = 'en'
      project = key = 'commons'
    } else {
      key = `${lang}${project}`.replace('wikipedia', 'wiki')
    }
    return { lang, project, key, title, url }
  } else {
    const key = site
    const specialProjectName = specialSites[key]
    if (specialProjectName) return { lang: 'en', project: specialProjectName, key }

    const [ lang, projectSuffix, rest ] = key.split('wik')

    // Detecting cases like 'frwikiwiki' that would return [ 'fr', 'i', 'i' ]
    if (rest != null) throw new Error(`invalid sitelink key: ${key}`)

    if (languages.indexOf(lang) === -1) {
      throw new Error(`sitelink lang not found: ${lang}`)
    }

    const project = projectsBySuffix[projectSuffix]
    if (!project) throw new Error(`sitelink project not found: ${project}`)

    return { lang, project, key }
  }
}

const specialSites = {
  commonswiki: 'commons',
  mediawikiwiki: 'mediawiki',
  metawiki: 'meta',
  specieswiki: 'specieswiki',
  wikidatawiki: 'wikidata',
  wikimaniawiki: 'wikimania'
}

const isSitelinkKey = site => {
  try {
    // relies on getSitelinkData validation
    getSitelinkData(site)
    return true
  } catch (err) {
    return false
  }
}

const projectsBySuffix = {
  i: 'wikipedia',
  isource: 'wikisource',
  iquote: 'wikiquote',
  tionary: 'wiktionary',
  ibooks: 'wikibooks',
  iversity: 'wikiversity',
  ivoyage: 'wikivoyage',
  inews: 'wikinews'
}

module.exports = { getSitelinkUrl, getSitelinkData, isSitelinkKey }

},{"../utils/utils":58,"./helpers":32,"./sitelinks_languages":45}],45:[function(require,module,exports){
// Generated by 'npm run update-sitelinks-languages'
module.exports = [
  'aa',
  'ab',
  'ace',
  'ady',
  'af',
  'ak',
  'als',
  'alt',
  'am',
  'ang',
  'an',
  'arc',
  'ar',
  'ary',
  'arz',
  'ast',
  'as',
  'atj',
  'avk',
  'av',
  'awa',
  'ay',
  'azb',
  'az',
  'ban',
  'bar',
  'bat_smg',
  'ba',
  'bcl',
  'be_x_old',
  'be',
  'bg',
  'bh',
  'bi',
  'bjn',
  'bm',
  'bn',
  'bo',
  'bpy',
  'br',
  'bs',
  'bug',
  'bxr',
  'ca',
  'cbk_zam',
  'cdo',
  'ceb',
  'ce',
  'cho',
  'chr',
  'ch',
  'chy',
  'ckb',
  'co',
  'crh',
  'cr',
  'csb',
  'cs',
  'cu',
  'cv',
  'cy',
  'dag',
  'da',
  'de',
  'din',
  'diq',
  'dsb',
  'dty',
  'dv',
  'dz',
  'ee',
  'el',
  'eml',
  'en',
  'eo',
  'es',
  'et',
  'eu',
  'ext',
  'fa',
  'ff',
  'fiu_vro',
  'fi',
  'fj',
  'fo',
  'frp',
  'frr',
  'fr',
  'fur',
  'fy',
  'gag',
  'gan',
  'ga',
  'gcr',
  'gd',
  'glk',
  'gl',
  'gn',
  'gom',
  'gor',
  'got',
  'gu',
  'gv',
  'hak',
  'ha',
  'haw',
  'he',
  'hif',
  'hi',
  'ho',
  'hr',
  'hsb',
  'ht',
  'hu',
  'hy',
  'hyw',
  'hz',
  'ia',
  'id',
  'ie',
  'ig',
  'ii',
  'ik',
  'ilo',
  'inh',
  'io',
  'is',
  'it',
  'iu',
  'jam',
  'ja',
  'jbo',
  'jv',
  'kaa',
  'kab',
  'ka',
  'kbd',
  'kbp',
  'kg',
  'ki',
  'kj',
  'kk',
  'kl',
  'km',
  'kn',
  'koi',
  'ko',
  'krc',
  'kr',
  'ksh',
  'ks',
  'ku',
  'kv',
  'kw',
  'ky',
  'lad',
  'la',
  'lbe',
  'lb',
  'lez',
  'lfn',
  'lg',
  'lij',
  'li',
  'lld',
  'lmo',
  'ln',
  'lo',
  'lrc',
  'ltg',
  'lt',
  'lv',
  'mad',
  'mai',
  'map_bms',
  'mdf',
  'mg',
  'mhr',
  'mh',
  'min',
  'mi',
  'mk',
  'ml',
  'mni',
  'mn',
  'mnw',
  'mo',
  'mrj',
  'mr',
  'ms',
  'mt',
  'mus',
  'mwl',
  'myv',
  'my',
  'mzn',
  'nah',
  'nap',
  'na',
  'nds_nl',
  'nds',
  'ne',
  'new',
  'ng',
  'nia',
  'nl',
  'nn',
  'nov',
  'no',
  'nqo',
  'nrm',
  'nso',
  'nv',
  'ny',
  'oc',
  'olo',
  'om',
  'or',
  'os',
  'pag',
  'pam',
  'pap',
  'pa',
  'pcd',
  'pdc',
  'pfl',
  'pih',
  'pi',
  'pl',
  'pms',
  'pnb',
  'pnt',
  'ps',
  'pt',
  'qu',
  'rm',
  'rmy',
  'rn',
  'roa_rup',
  'roa_tara',
  'ro',
  'rue',
  'ru',
  'rw',
  'sah',
  'sat',
  'sa',
  'scn',
  'sco',
  'sc',
  'sd',
  'se',
  'sg',
  'shi',
  'shn',
  'sh',
  'shy',
  'simple',
  'si',
  'skr',
  'sk',
  'sl',
  'smn',
  'sm',
  'sn',
  'sources',
  'so',
  'sq',
  'srn',
  'sr',
  'ss',
  'stq',
  'st',
  'su',
  'sv',
  'sw',
  'szl',
  'szy',
  'ta',
  'tay',
  'tcy',
  'tet',
  'te',
  'tg',
  'th',
  'ti',
  'tk',
  'tl',
  'tn',
  'to',
  'tpi',
  'trv',
  'tr',
  'ts',
  'tt',
  'tum',
  'tw',
  'tyv',
  'ty',
  'udm',
  'ug',
  'uk',
  'ur',
  'uz',
  'vec',
  'vep',
  've',
  'vi',
  'vls',
  'vo',
  'war',
  'wa',
  'wo',
  'wuu',
  'xal',
  'xh',
  'xmf',
  'yi',
  'yo',
  'yue',
  'za',
  'zea',
  'zh_classical',
  'zh_min_nan',
  'zh_yue',
  'zh',
  'zu'
]

},{}],46:[function(require,module,exports){
const helpers = require('./helpers')

const validate = (name, testName) => value => {
  if (!helpers[testName](value)) throw new Error(`invalid ${name}: ${value}`)
}

module.exports = {
  entityId: validate('entity id', 'isEntityId'),
  propertyId: validate('property id', 'isPropertyId'),
  entityPageTitle: validate('entity page title', 'isEntityPageTitle'),
  revisionId: validate('revision id', 'isRevisionId')
}

},{"./helpers":32}],47:[function(require,module,exports){
module.exports = wikibaseTime => {
  // Also accept claim datavalue.value objects
  if (typeof wikibaseTime === 'object') {
    wikibaseTime = wikibaseTime.time
  }

  const sign = wikibaseTime[0]
  let [ yearMonthDay, withinDay ] = wikibaseTime.slice(1).split('T')

  // Wikidata generates invalid ISO dates to indicate precision
  // ex: +1990-00-00T00:00:00Z to indicate 1990 with year precision
  yearMonthDay = yearMonthDay.replace(/-00/g, '-01')
  const rest = `${yearMonthDay}T${withinDay}`

  return fullDateData(sign, rest)
}

const fullDateData = (sign, rest) => {
  const year = rest.split('-')[0]
  const needsExpandedYear = sign === '-' || year.length > 4

  return needsExpandedYear ? expandedYearDate(sign, rest, year) : new Date(rest)
}

const expandedYearDate = (sign, rest, year) => {
  let date
  // Using ISO8601 expanded notation for negative years or positive
  // years with more than 4 digits: adding up to 2 leading zeros
  // when needed. Can't find the documentation again, but testing
  // with `new Date(date)` gives a good clue of the implementation
  if (year.length === 4) {
    date = `${sign}00${rest}`
  } else if (year.length === 5) {
    date = `${sign}0${rest}`
  } else {
    date = sign + rest
  }
  return new Date(date)
}

},{}],48:[function(require,module,exports){
// See https://www.wikidata.org/w/api.php?action=help&modules=query%2Bsearch

const { isPlainObject } = require('../utils/utils')
const namespacePattern = /^\d+[|\d]*$/

module.exports = buildUrl => params => {
  if (!isPlainObject(params)) {
    throw new Error(`expected parameters to be passed as an object, got ${params} (${typeof params})`)
  }

  const { search, haswbstatement, format = 'json', limit, offset, profile, sort } = params
  let { namespace } = params

  if (!(search || haswbstatement)) throw new Error('missing "search" or "haswbstatement" parameter')

  let srsearch = ''
  if (search) srsearch += search

  if (haswbstatement) {
    const statements = haswbstatement instanceof Array ? haswbstatement : [ haswbstatement ]
    for (const statement of statements) {
      if (statement[0] === '-') srsearch += ` -haswbstatement:${statement.slice(1)}`
      else srsearch += ` haswbstatement:${statement}`
    }
  }

  if (limit != null && (typeof limit !== 'number' || limit < 1)) {
    throw new Error(`invalid limit: ${limit}`)
  }

  if (offset != null && (typeof offset !== 'number' || offset < 0)) {
    throw new Error(`invalid offset: ${offset}`)
  }

  if (namespace instanceof Array) namespace = namespace.join('|')
  else if (typeof namespace === 'number') namespace = namespace.toString()

  if (namespace && !namespacePattern.test(namespace)) {
    throw new Error(`invalid namespace: ${namespace}`)
  }

  if (profile != null && typeof profile !== 'string') {
    throw new Error(`invalid profile: ${profile} (${typeof profile}, expected string)`)
  }

  if (sort != null && typeof sort !== 'string') {
    throw new Error(`invalid sort: ${sort} (${typeof sort}, expected string)`)
  }

  return buildUrl({
    action: 'query',
    list: 'search',
    srsearch: srsearch.trim(),
    format,
    srnamespace: namespace,
    srlimit: limit,
    sroffset: offset,
    srqiprofile: profile,
    srsort: sort,
  })
}

},{"../utils/utils":58}],49:[function(require,module,exports){
const { isPlainObject, forceArray, shortLang } = require('../utils/utils')
const validate = require('../helpers/validate')

module.exports = buildUrl => (ids, languages, props, format, redirects) => {
  // Polymorphism: arguments can be passed as an object keys
  if (isPlainObject(ids)) {
    ({ ids, languages, props, format, redirects } = ids)
  }

  format = format || 'json'

  // ids can't be let empty
  if (!(ids && ids.length > 0)) throw new Error('no id provided')

  // Allow to pass ids as a single string
  ids = forceArray(ids)

  ids.forEach(validate.entityId)

  if (ids.length > 50) {
    console.warn(`getEntities accepts 50 ids max to match Wikidata API limitations:
      this request won't get all the desired entities.
      You can use getManyEntities instead to generate several request urls
      to work around this limitation`)
  }

  // Properties can be either one property as a string
  // or an array or properties;
  // either case me just want to deal with arrays

  const query = {
    action: 'wbgetentities',
    ids: ids.join('|'),
    format
  }

  if (redirects === false) query.redirects = 'no'

  if (languages) {
    languages = forceArray(languages).map(shortLang)
    query.languages = languages.join('|')
  }

  if (props && props.length > 0) query.props = forceArray(props).join('|')

  return buildUrl(query)
}

},{"../helpers/validate":46,"../utils/utils":58}],50:[function(require,module,exports){
const { isPlainObject, forceArray, shortLang } = require('../utils/utils')

module.exports = buildUrl => (titles, sites, languages, props, format, redirects) => {
  // polymorphism: arguments can be passed as an object keys
  if (isPlainObject(titles)) {
    // Not using destructuring assigment there as it messes with both babel and standard
    const params = titles
    titles = params.titles
    sites = params.sites
    languages = params.languages
    props = params.props
    format = params.format
    redirects = params.redirects
  }

  format = format || 'json'

  // titles cant be let empty
  if (!(titles && titles.length > 0)) throw new Error('no titles provided')
  // default to the English Wikipedia
  if (!(sites && sites.length > 0)) sites = [ 'enwiki' ]

  // Properties can be either one property as a string
  // or an array or properties;
  // either case me just want to deal with arrays
  titles = forceArray(titles)
  sites = forceArray(sites).map(parseSite)
  props = forceArray(props)

  const query = {
    action: 'wbgetentities',
    titles: titles.join('|'),
    sites: sites.join('|'),
    format
  }

  // Normalizing only works if there is only one site and title
  if (sites.length === 1 && titles.length === 1) {
    query.normalize = true
  }

  if (languages) {
    languages = forceArray(languages).map(shortLang)
    query.languages = languages.join('|')
  }

  if (props && props.length > 0) query.props = props.join('|')

  if (redirects === false) query.redirects = 'no'

  return buildUrl(query)
}

// convert 2 letters language code to Wikipedia sitelinks code
const parseSite = site => site.length === 2 ? `${site}wiki` : site

},{"../utils/utils":58}],51:[function(require,module,exports){
const validate = require('../helpers/validate')
const { isPlainObject } = require('../utils/utils')

module.exports = (instance, wgScriptPath) => (id, revision) => {
  if (isPlainObject(id)) {
    revision = id.revision
    id = id.id
  }
  validate.entityId(id)
  validate.revisionId(revision)
  return `${instance}/${wgScriptPath}/index.php?title=Special:EntityData/${id}.json&revision=${revision}`
}

},{"../helpers/validate":46,"../utils/utils":58}],52:[function(require,module,exports){
const { isPlainObject } = require('../utils/utils')

module.exports = buildUrl => {
  const getEntities = require('./get_entities')(buildUrl)
  return (ids, languages, props, format, redirects) => {
    // Polymorphism: arguments can be passed as an object keys
    if (isPlainObject(ids)) {
      ({ ids, languages, props, format, redirects } = ids)
    }

    if (!(ids instanceof Array)) throw new Error('getManyEntities expects an array of ids')

    return getIdsGroups(ids)
    .map(idsGroup => getEntities(idsGroup, languages, props, format, redirects))
  }
}

const getIdsGroups = ids => {
  const groups = []
  while (ids.length > 0) {
    const group = ids.slice(0, 50)
    ids = ids.slice(50)
    groups.push(group)
  }
  return groups
}

},{"../utils/utils":58,"./get_entities":49}],53:[function(require,module,exports){
const { forceArray } = require('../utils/utils')
const { isItemId } = require('../helpers/helpers')
const validate = require('../helpers/validate')

// Fiter-out properties. Can't be filtered by
// `?subject a wikibase:Item`, as those triples are omitted
// https://www.mediawiki.org/wiki/Wikibase/Indexing/RDF_Dump_Format#WDQS_data_differences
const itemsOnly = 'FILTER NOT EXISTS { ?subject rdf:type wikibase:Property . } '

module.exports = sparqlEndpoint => {
  const sparqlQuery = require('./sparql_query')(sparqlEndpoint)
  return (property, value, options = {}) => {
    const { limit, caseInsensitive, keepProperties } = options
    const valueFn = caseInsensitive ? caseInsensitiveValueQuery : directValueQuery
    const filter = keepProperties ? '' : itemsOnly

    // Allow to request values for several properties at once
    let properties = forceArray(property)
    properties.forEach(validate.propertyId)
    properties = properties.map(prefixifyProperty).join('|')

    const valueBlock = getValueBlock(value, valueFn, properties, filter)
    let sparql = `SELECT DISTINCT ?subject WHERE { ${valueBlock} }`
    if (limit) sparql += ` LIMIT ${limit}`
    return sparqlQuery(sparql)
  }
}

const getValueBlock = (value, valueFn, properties, filter) => {
  if (!(value instanceof Array)) {
    return valueFn(properties, getValueString(value), filter)
  }

  const valuesBlocks = value
    .map(getValueString)
    .map(valStr => valueFn(properties, valStr, filter))

  return '{ ' + valuesBlocks.join('} UNION {') + ' }'
}

const getValueString = value => {
  if (isItemId(value)) {
    value = `wd:${value}`
  } else if (typeof value === 'string') {
    value = `'${value}'`
  }
  return value
}

const directValueQuery = (properties, value, filter, limit) => {
  return `?subject ${properties} ${value} .
    ${filter}`
}

// Discussion on how to make this query optimal:
// http://stackoverflow.com/q/43073266/3324977
const caseInsensitiveValueQuery = (properties, value, filter, limit) => {
  return `?subject ${properties} ?value .
    FILTER (lcase(?value) = ${value.toLowerCase()})
    ${filter}`
}

const prefixifyProperty = property => 'wdt:' + property

},{"../helpers/helpers":32,"../helpers/validate":46,"../utils/utils":58,"./sparql_query":56}],54:[function(require,module,exports){
const { forceArray } = require('../utils/utils')
const validate = require('../helpers/validate')

module.exports = buildUrl => (ids, options = {}) => {
  ids = forceArray(ids)
  ids.forEach(validate.entityPageTitle)

  const uniqueId = ids.length === 1
  const query = {
    action: 'query',
    prop: 'revisions'
  }

  query.titles = ids.join('|')
  query.format = options.format || 'json'
  if (uniqueId) query.rvlimit = options.limit || 'max'
  if (uniqueId && options.start) query.rvstart = getEpochSeconds(options.start)
  if (uniqueId && options.end) query.rvend = getEpochSeconds(options.end)

  const { prop, user, excludeuser, tag } = options
  if (prop) query.rvprop = forceArray(prop).join('|')
  if (user) query.rvuser = user
  if (excludeuser) query.rvexcludeuser = excludeuser
  if (tag) query.rvtag = tag

  return buildUrl(query)
}

const getEpochSeconds = date => {
  // Return already formatted epoch seconds:
  // if a date in milliseconds appear to be earlier than 2000-01-01, that's probably
  // already seconds actually
  if (typeof date === 'number' && date < earliestPointInMs) return date
  return Math.trunc(new Date(date).getTime() / 1000)
}

const earliestPointInMs = new Date('2000-01-01').getTime()

},{"../helpers/validate":46,"../utils/utils":58}],55:[function(require,module,exports){
const { isPlainObject } = require('../utils/utils')
const types = [ 'item', 'property', 'lexeme', 'form', 'sense' ]

module.exports = buildUrl => (search, language, limit, format, uselang) => {
  // Using the variable 'offset' instead of 'continue' as the later is a reserved word
  let type, offset

  // polymorphism: arguments can be passed as an object keys
  if (isPlainObject(search)) {
    // Not using destructuring assigment there as it messes with both babel and standard
    const params = search
    search = params.search
    language = params.language
    limit = params.limit
    offset = params.continue
    format = params.format
    uselang = params.uselang
    type = params.type
  }

  if (!(search && search.length > 0)) throw new Error("search can't be empty")

  language = language || 'en'
  uselang = uselang || language
  limit = limit || '20'
  format = format || 'json'
  type = type || 'item'
  offset = offset || '0'

  if (!types.includes(type)) throw new Error(`invalid type: ${type}`)

  return buildUrl({
    action: 'wbsearchentities',
    search,
    language,
    limit,
    continue: offset,
    format,
    uselang,
    type
  })
}

},{"../utils/utils":58}],56:[function(require,module,exports){
const { fixedEncodeURIComponent } = require('../utils/utils')

module.exports = sparqlEndpoint => sparql => {
  const query = fixedEncodeURIComponent(sparql)
  return `${sparqlEndpoint}?format=json&query=${query}`
}

},{"../utils/utils":58}],57:[function(require,module,exports){
const isBrowser = typeof location !== 'undefined' && typeof document !== 'undefined'

let stringifyQuery
if (isBrowser) {
  stringifyQuery = queryObj => new URLSearchParams(queryObj).toString()
} else {
  // TODO: use URLSearchParams in NodeJS too, but that would mean dropping support for NodeJS < v10
  stringifyQuery = require('querystring').stringify
}

module.exports = instanceApiEndpoint => queryObj => {
  // Request CORS headers if the request is made from a browser
  // See https://www.wikidata.org/w/api.php ('origin' parameter)
  if (isBrowser) queryObj.origin = '*'

  // Remove null or undefined parameters
  Object.keys(queryObj).forEach(key => {
    if (queryObj[key] == null) delete queryObj[key]
  })

  return instanceApiEndpoint + '?' + stringifyQuery(queryObj)
}

},{"querystring":64}],58:[function(require,module,exports){
module.exports = {
  // Ex: keep only 'fr' in 'fr_FR'
  shortLang: language => language.toLowerCase().split('_')[0],

  // a polymorphism helper:
  // accept either a string or an array and return an array
  forceArray: array => {
    if (typeof array === 'string') array = [ array ]
    return array || []
  },

  // simplistic implementation to filter-out arrays
  isPlainObject: obj => {
    if (!obj || typeof obj !== 'object' || obj instanceof Array) return false
    return true
  },

  // encodeURIComponent ignores !, ', (, ), and *
  // cf https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent#Description
  fixedEncodeURIComponent: str => {
    return encodeURIComponent(str).replace(/[!'()*]/g, encodeCharacter)
  },

  replaceSpaceByUnderscores: str => str.replace(/\s/g, '_'),

  uniq: array => Array.from(new Set(array))
}

const encodeCharacter = char => '%' + char.charCodeAt(0).toString(16)

},{}],59:[function(require,module,exports){
const { isPlainObject } = require('./utils/utils')

const simplify = require('./helpers/simplify')
const parse = require('./helpers/parse_responses')
const helpers = require('./helpers/helpers')
const sitelinksHelpers = require('../lib/helpers/sitelinks')
const rankHelpers = require('../lib/helpers/rank')
const tip = `Tip: if you just want to access functions that don't need an instance or a sparqlEndpoint,
those are also exposed directly on the module object. Exemple:
const { isItemId, simplify } = require('wikibase-sdk')`

const common = Object.assign({ simplify, parse }, helpers, sitelinksHelpers, rankHelpers)

const WBK = config => {
  if (!isPlainObject(config)) throw new Error('invalid config')
  const { instance, sparqlEndpoint } = config
  let { wgScriptPath = 'w' } = config

  wgScriptPath = wgScriptPath.replace(/^\//, '')

  if (!(instance || sparqlEndpoint)) {
    throw new Error(`one of instance or sparqlEndpoint should be set at initialization.\n${tip}`)
  }

  let wikibaseApiFunctions, instanceRoot, instanceApiEndpoint
  if (instance) {
    validateEndpoint('instance', instance)

    instanceRoot = instance
      .replace(/\/$/, '')
      .replace(`/${wgScriptPath}/api.php`, '')

    instanceApiEndpoint = `${instanceRoot}/${wgScriptPath}/api.php`

    const buildUrl = require('./utils/build_url')(instanceApiEndpoint)

    wikibaseApiFunctions = {
      searchEntities: require('./queries/search_entities')(buildUrl),
      cirrusSearchPages: require('./queries/cirrus_search')(buildUrl),
      getEntities: require('./queries/get_entities')(buildUrl),
      getManyEntities: require('./queries/get_many_entities')(buildUrl),
      getRevisions: require('./queries/get_revisions')(buildUrl),
      getEntityRevision: require('./queries/get_entity_revision')(instance, wgScriptPath),
      getEntitiesFromSitelinks: require('./queries/get_entities_from_sitelinks')(buildUrl)
    }
  } else {
    wikibaseApiFunctions = {
      searchEntities: missingInstance('searchEntities'),
      cirrusSearchPages: missingInstance('cirrusSearchPages'),
      getEntities: missingInstance('getEntities'),
      getManyEntities: missingInstance('getManyEntities'),
      getRevisions: missingInstance('getRevisions'),
      getEntityRevision: missingInstance('getEntityRevision'),
      getEntitiesFromSitelinks: missingInstance('getEntitiesFromSitelinks')
    }
  }

  let wikibaseQueryServiceFunctions
  if (sparqlEndpoint) {
    validateEndpoint('sparqlEndpoint', sparqlEndpoint)
    wikibaseQueryServiceFunctions = {
      sparqlQuery: require('./queries/sparql_query')(sparqlEndpoint),
      getReverseClaims: require('./queries/get_reverse_claims')(sparqlEndpoint)
    }
  } else {
    wikibaseQueryServiceFunctions = {
      sparqlQuery: missingSparqlEndpoint('sparqlQuery'),
      getReverseClaims: missingSparqlEndpoint('getReverseClaims')
    }
  }

  const parsedData = {
    instance: {
      root: instanceRoot,
      apiEndpoint: instanceApiEndpoint
    }
  }

  return Object.assign(parsedData, common, wikibaseApiFunctions, wikibaseQueryServiceFunctions)
}

// Make heplpers that don't require an instance to be specified available
// directly on the exported function object
Object.assign(WBK, common)

const validateEndpoint = (name, url) => {
  if (!(typeof url === 'string' && url.startsWith('http'))) {
    throw new Error(`invalid ${name}: ${url}`)
  }
}

const missingConfig = missingParameter => name => () => {
  throw new Error(`${name} requires ${missingParameter} to be set at initialization`)
}

const missingSparqlEndpoint = missingConfig('a sparqlEndpoint')
const missingInstance = missingConfig('an instance')

module.exports = WBK

},{"../lib/helpers/rank":35,"../lib/helpers/sitelinks":44,"./helpers/helpers":32,"./helpers/parse_responses":34,"./helpers/simplify":36,"./queries/cirrus_search":48,"./queries/get_entities":49,"./queries/get_entities_from_sitelinks":50,"./queries/get_entity_revision":51,"./queries/get_many_entities":52,"./queries/get_reverse_claims":53,"./queries/get_revisions":54,"./queries/search_entities":55,"./queries/sparql_query":56,"./utils/build_url":57,"./utils/utils":58}],60:[function(require,module,exports){
module.exports = require('wikibase-sdk')({
  instance: 'https://www.wikidata.org',
  sparqlEndpoint: 'https://query.wikidata.org/sparql'
})

},{"wikibase-sdk":59}],61:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],62:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

// If obj.hasOwnProperty has been overridden, then calling
// obj.hasOwnProperty(prop) will break.
// See: https://github.com/joyent/node/issues/1707
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

module.exports = function(qs, sep, eq, options) {
  sep = sep || '&';
  eq = eq || '=';
  var obj = {};

  if (typeof qs !== 'string' || qs.length === 0) {
    return obj;
  }

  var regexp = /\+/g;
  qs = qs.split(sep);

  var maxKeys = 1000;
  if (options && typeof options.maxKeys === 'number') {
    maxKeys = options.maxKeys;
  }

  var len = qs.length;
  // maxKeys <= 0 means that we should not limit keys count
  if (maxKeys > 0 && len > maxKeys) {
    len = maxKeys;
  }

  for (var i = 0; i < len; ++i) {
    var x = qs[i].replace(regexp, '%20'),
        idx = x.indexOf(eq),
        kstr, vstr, k, v;

    if (idx >= 0) {
      kstr = x.substr(0, idx);
      vstr = x.substr(idx + 1);
    } else {
      kstr = x;
      vstr = '';
    }

    k = decodeURIComponent(kstr);
    v = decodeURIComponent(vstr);

    if (!hasOwnProperty(obj, k)) {
      obj[k] = v;
    } else if (isArray(obj[k])) {
      obj[k].push(v);
    } else {
      obj[k] = [obj[k], v];
    }
  }

  return obj;
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

},{}],63:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var stringifyPrimitive = function(v) {
  switch (typeof v) {
    case 'string':
      return v;

    case 'boolean':
      return v ? 'true' : 'false';

    case 'number':
      return isFinite(v) ? v : '';

    default:
      return '';
  }
};

module.exports = function(obj, sep, eq, name) {
  sep = sep || '&';
  eq = eq || '=';
  if (obj === null) {
    obj = undefined;
  }

  if (typeof obj === 'object') {
    return map(objectKeys(obj), function(k) {
      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
      if (isArray(obj[k])) {
        return map(obj[k], function(v) {
          return ks + encodeURIComponent(stringifyPrimitive(v));
        }).join(sep);
      } else {
        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
      }
    }).join(sep);

  }

  if (!name) return '';
  return encodeURIComponent(stringifyPrimitive(name)) + eq +
         encodeURIComponent(stringifyPrimitive(obj));
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

function map (xs, f) {
  if (xs.map) return xs.map(f);
  var res = [];
  for (var i = 0; i < xs.length; i++) {
    res.push(f(xs[i], i));
  }
  return res;
}

var objectKeys = Object.keys || function (obj) {
  var res = [];
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
  }
  return res;
};

},{}],64:[function(require,module,exports){
'use strict';

exports.decode = exports.parse = require('./decode');
exports.encode = exports.stringify = require('./encode');

},{"./decode":62,"./encode":63}]},{},[1]);
