/**
 * alias for "fn()"
 */
export declare function alterState(func: Operation): Operation;

/**
 * Turns an array into a string, separated by X.
 * @example
 * field("destination_string__c", function(state) {
 *   return arrayToString(dataValue("path_of_array")(state), ', ')
 * })
 * @param arr - Array of toString'able primatives.
 * @param separator - Separator string.
 */
export declare function arrayToString(arr: any[], separator: string): string[];

/**
 * Scopes an array of data based on a JSONPath.
 * Useful when the source data has `n` items you would like to map to
 * an operation.
 * The operation will receive a slice of the data based of each item
 * of the JSONPath provided.
 * @example
 * map("$.[*]",
 *   create("SObject",
 *     field("FirstName", sourceValue("$.firstName"))
 *   )
 * )
 * @function
 * @param {string} path - JSONPath referencing a point in `state.data`.
 * @param {function} operation - The operation needed to be repeated.
 * @param {State} state - Runtime state.
 * @returns {<State>}
 */
/**
 * Simple switcher allowing other expressions to use either a JSONPath or
 * object literals as a data source.
 * - JSONPath referencing a point in `state`
 * - Object Literal of the data itself.
 * - Function to be called with state.
 * @example
 * asData('$.key'| key | callback)
 * @param data
 * @param state - The current state.
 */
export declare function asData(data: DataSource, state: State): any;

declare const axios: AxiosStatic;

declare interface AxiosAdapter {
    (config: AxiosRequestConfig): AxiosPromise<any>;
}

declare interface AxiosBasicCredentials {
    username: string;
    password: string;
}

declare interface AxiosError<T = any> extends Error {
    config: AxiosRequestConfig;
    code?: string;
    request?: any;
    response?: AxiosResponse<T>;
    isAxiosError: boolean;
    toJSON: () => object;
}

declare interface AxiosInstance {
    (config: AxiosRequestConfig): AxiosPromise;
    (url: string, config?: AxiosRequestConfig): AxiosPromise;
    defaults: AxiosRequestConfig;
    interceptors: {
        request: AxiosInterceptorManager<AxiosRequestConfig>;
        response: AxiosInterceptorManager<AxiosResponse>;
    };
    getUri(config?: AxiosRequestConfig): string;
    request<T = any, R = AxiosResponse<T>> (config: AxiosRequestConfig): Promise<R>;
    get<T = any, R = AxiosResponse<T>>(url: string, config?: AxiosRequestConfig): Promise<R>;
    delete<T = any, R = AxiosResponse<T>>(url: string, config?: AxiosRequestConfig): Promise<R>;
    head<T = any, R = AxiosResponse<T>>(url: string, config?: AxiosRequestConfig): Promise<R>;
    options<T = any, R = AxiosResponse<T>>(url: string, config?: AxiosRequestConfig): Promise<R>;
    post<T = any, R = AxiosResponse<T>>(url: string, data?: any, config?: AxiosRequestConfig): Promise<R>;
    put<T = any, R = AxiosResponse<T>>(url: string, data?: any, config?: AxiosRequestConfig): Promise<R>;
    patch<T = any, R = AxiosResponse<T>>(url: string, data?: any, config?: AxiosRequestConfig): Promise<R>;
}

declare interface AxiosInterceptorManager<V> {
    use(onFulfilled?: (value: V) => V | Promise<V>, onRejected?: (error: any) => any): number;
    eject(id: number): void;
}

declare interface AxiosPromise<T = any> extends Promise<AxiosResponse<T>> {
}

declare interface AxiosProxyConfig {
    host: string;
    port: number;
    auth?: {
        username: string;
        password:string;
    };
    protocol?: string;
}

declare interface AxiosRequestConfig {
    url?: string;
    method?: Method;
    baseURL?: string;
    transformRequest?: AxiosTransformer | AxiosTransformer[];
    transformResponse?: AxiosTransformer | AxiosTransformer[];
    headers?: any;
    params?: any;
    paramsSerializer?: (params: any) => string;
    data?: any;
    timeout?: number;
    timeoutErrorMessage?: string;
    withCredentials?: boolean;
    adapter?: AxiosAdapter;
    auth?: AxiosBasicCredentials;
    responseType?: ResponseType_2;
    xsrfCookieName?: string;
    xsrfHeaderName?: string;
    onUploadProgress?: (progressEvent: any) => void;
    onDownloadProgress?: (progressEvent: any) => void;
    maxContentLength?: number;
    validateStatus?: ((status: number) => boolean) | null;
    maxBodyLength?: number;
    maxRedirects?: number;
    socketPath?: string | null;
    httpAgent?: any;
    httpsAgent?: any;
    proxy?: AxiosProxyConfig | false;
    cancelToken?: CancelToken;
    decompress?: boolean;
}

declare interface AxiosResponse<T = any>  {
    data: T;
    status: number;
    statusText: string;
    headers: any;
    config: AxiosRequestConfig;
    request?: any;
}

declare interface AxiosStatic extends AxiosInstance {
    create(config?: AxiosRequestConfig): AxiosInstance;
    Cancel: CancelStatic;
    CancelToken: CancelTokenStatic;
    isCancel(value: any): boolean;
    all<T>(values: (T | Promise<T>)[]): Promise<T[]>;
    spread<T, R>(callback: (...args: T[]) => R): (array: T[]) => R;
    isAxiosError(payload: any): payload is AxiosError;
}

declare interface AxiosTransformer {
    (data: any, headers?: any): any;
}

export declare namespace beta {
    /**
     * Scopes an array of data based on a JSONPath.
     * Useful when the source data has `n` items you would like to map to
     * an operation.
     * The operation will receive a slice of the data based of each item
     * of the JSONPath provided.
     *
     * It also ensures the results of an operation make their way back into
     * the state's references.
     * @example
     *  each("$.[*]",
     *    create("SObject",
     *    field("FirstName", sourceValue("$.firstName")))
     *  )
     * @param dataSource - JSONPath referencing a point in `state`.
     * @param operation - The operation needed to be repeated.
     */
    export function each(dataSource: DataSource, operation: Operation): Operation;
}

declare interface Cancel {
    message: string;
}

declare interface Canceler {
    (message?: string): void;
}

declare interface CancelStatic {
    new (message?: string): Cancel;
}

declare interface CancelToken {
    promise: Promise<Cancel>;
    reason?: Cancel;
    throwIfRequested(): void;
}

declare interface CancelTokenSource {
    token: CancelToken;
    cancel: Canceler;
}

declare interface CancelTokenStatic {
    new (executor: (cancel: Canceler) => void): CancelToken;
    source(): CancelTokenSource;
}

/**
 * Combines two operations into one
 * @example
 * combine(
 *   create('foo'),
 *   delete('bar')
 * )
 * @function
 * @param operations - Operations to be performed.
 */
export declare function combine(...operations: Array<Operation>): Operation;

/**
 * Prepares next state
 * @example
 * composeNextState(state, response)
 * @param state - state
 * @param response - Response to be added
 */
export declare function composeNextState(state: State, response: any): State;

/**
 * Remove prepending `$.`, `$` or `.`, in order to ensure the root of the
 * path starts with `$.data.`
 * @example
 * dataPath('key')
 * @param path - JSONPath referencing a point in `data`.
 */
export declare function dataPath(path: string): string;

export declare type DataSource = object | string | Selector<object | string>;

/**
 * Picks out a single value from the source data object—usually `state.data`.
 * If a JSONPath returns more than one value for the reference, the first
 * item will be returned.
 * @example
 * dataValue('key')
 * @param path - JSONPath referencing a point in `data`.
 */
export declare function dataValue(path: string): Selector<(Object | String)[]>;

/**
 * Make a DELETE request
 * @public
 * @function
 * @param {object} requestParams - Supports the exact parameters as Axios. See {@link https://github.com/axios/axios#axios-api here}
 * @example <caption>Deleting a record with data that comes from state</caption>
 * delete({
 *    url: state => `https://www.example.com/api/items/${state.id}`,
 *  })(state);
 * @returns {Operation} - Function which takes state and returns a Promise
 */
declare function del(requestParams: any): (state: any) => AxiosPromise<any>;

/**
 * Scopes an array of data based on a JSONPath.
 * Useful when the source data has `n` items you would like to map to
 * an operation.
 * The operation will receive a slice of the data based of each item
 * of the JSONPath provided.
 *
 * It also ensures the results of an operation make their way back into
 * the state's references.
 * @example
 * each("$.[*]",
 *   create("SObject",
 *     field("FirstName", sourceValue("$.firstName"))
 *   )
 * )
 * @param dataSource - JSONPath referencing a point in `state`.
 * @param operation - The operation needed to be repeated.
 */
export declare function each(dataSource: DataSource, operation: Function): Operation;

/**
 * Execute a sequence of operations.
 * Main outer API for executing expressions.
 * @example
 *  execute(
 *    create('foo'),
 *    delete('bar')
 *  )
 */
export declare function execute(...operations: Array<Operation>): Operation;

/**
 * Recursively resolves objects that have resolvable values (functions).
 * @function
 * @param value - data
 * @param [skipFilter] - a function which returns true if a value should be skipped
 */
export declare function expandReferences(value: any[] | object | Function, skipFilter?: (val: any) => Boolean): Selector<any>;

/**
 * Recursively resolves objects that have resolvable values (functions), but
 * omits HTTP request specific modules like `FormData`.
 * @public
 * @function
 * @param {object} value - data
 * @returns {<Operation>}
 */
declare function expandRequestReferences(params: any): (state: any) => any;

export declare type Field = [string, string | object | any[]];

/**
 * Returns a key, value pair in an array.
 * @example
 * field('destination_field_name__c', 'value')
 * @param key - Name of the field
 * @param value - The value itself or a sourceable operation.
 */
export declare function field(key: string, value: any): Field;

/**
 * Zips key value pairs into an object.
 * @example
 *  fields(list_of_fields)
 * @param fields - a list of fields
 */
export declare function fields(...fields: Field[]): object;

/**
 * Creates a custom step (or operation) for more flexible job writing.
 * @example
 * fn(state => {
 *   // do some things to state
 *   return state;
 * });
 */
export declare function fn(func: Operation): Operation;

/**
 * Make a GET request
 * @public
 * @function
 * @param {object} requestParams - Supports the exact parameters as Axios. See {@link https://github.com/axios/axios#axios-api here}
 * @returns {Operation} - Function which takes state and returns a Promise
 * @example <caption>Get an item with a specified id from state</caption>
 *  get({
 *      url: state => `https://www.example.com/api/items/${state.id},
 *      headers: {"content-type": "application/json"}
 * });
 */
declare function get(requestParams: any): (state: State) => AxiosPromise<any>;

/**
 * Make a HEAD request
 * @public
 * @function
 * @param {object} requestParams - Supports the exact parameters as Axios. See {@link https://github.com/axios/axios#axios-api here}
 * @example <caption>Gets the headers that would be returned if the HEAD request's URL was instead requested with the HTTP GET method</caption>
 * head({
 *   url: 'https://www.example.com/api/items',
 * });
 * @returns {Operation} - Function which takes state and returns a Promise
 */
declare function head(requestParams: any): (state: any) => AxiosPromise<any>;

declare namespace http {
    export {
        expandRequestReferences,
        get,
        post,
        head,
        put,
        patch,
        options,
        axios,
        del as delete
    }
}
export { http }

/**
 * Subsitutes underscores for spaces and proper-cases a string
 * @public
 * @example
 * field("destination_string__c", humanProper(state.data.path_to_string))
 * @function
 * @param str - String that needs converting
 */
export declare function humanProper(str: string): string;

/**
 * Returns the index of the current array being iterated.
 * To be used with `each` as a data source.
 * @example
 * index()
 */
export declare function index(): Selector<number | undefined>;

/**
 * Adds data from a target object
 * @example
 * join('$.key','$.data','newKey')
 * @function
 * @param targetPath - Target path
 * @param sourcePath - Source path
 * @param targetKey - Target Key
 */
export declare function join(targetPath: string, sourcePath: string, targetKey: string): Operation;

/**
 * Picks out the last reference value from source data.
 * @example
 * lastReferenceValue('key')
 * @param path - JSONPath referencing a point in `references`.
 */
export declare function lastReferenceValue(path: string): Selector<(Object | String)[]>;

/**
 * Merges fields into each item in an array.
 * @public
 * @example
 * merge(
 *   "$.books[*]",
 *   fields(
 *     field( "publisher", sourceValue("$.publisher") )
 *   )
 * )
 * @param dataSource
 * @param {Object} fields - Group of fields to merge in.
 * @returns {DataSource}
 */
export declare function merge(dataSource: string, fields: object): Operation;

declare type Method =
| 'get' | 'GET'
| 'delete' | 'DELETE'
| 'head' | 'HEAD'
| 'options' | 'OPTIONS'
| 'post' | 'POST'
| 'put' | 'PUT'
| 'patch' | 'PATCH'
| 'purge' | 'PURGE'
| 'link' | 'LINK'
| 'unlink' | 'UNLINK'

export declare interface Operation<T = Promise<State> | State> {
    (state: State): T;
}

/**
 * Make a OPTIONS request
 * @public
 * @function
 * @param {object} requestParams - Supports the exact parameters as Axios. See {@link https://github.com/axios/axios#axios-api here}
 * @example <caption>Requests permitted communication options for a given URL or server, with data from state.</caption>
 * options({
 *   url: 'https://www.example.com/api/items',
 * });
 * @returns {Operation} - Function which takes state and returns a Promise
 */
declare function options(requestParams: any): (state: any) => AxiosPromise<any>;

/**
 * Make a PATCH request
 * @public
 * @function
 * @param {object} requestParams - Supports the exact parameters as Axios. See {@link https://github.com/axios/axios#axios-api here}
 * @example <caption>Applies partial modifications to a resource, with data from state.</caption>
 * patch({
 *   url: state => `https://www.example.com/api/items/${state.id}`,
 *   data: state => state.data
 * });
 * @returns {Operation} - Function which takes state and returns a Promise
 */
declare function patch(requestParams: any): (state: any) => AxiosPromise<any>;

/**
 * Make a POST request
 * @public
 * @function
 * @param {object} requestParams - Supports the exact parameters as Axios. See {@link https://github.com/axios/axios#axios-api here}
 * @example <caption>Sending a payload with data that comes from state</caption>
 * post({
 *   url: "https://example.com",
 *   data: (state) => state.data
 * });
 * @example <caption> Capturing the response for later use in state </caption>
 * alterState((state) => {
 *   return post({
 *     url: "https://example.com",
 *     data: (state) => state.data
 *   })(state).then(({response}) => {
 *    state.responseData = response.data
 *   })
 * });
 * @returns {Operation} - Function which takes state and returns a Promise
 */
declare function post(requestParams: any): (state: any) => AxiosPromise<any>;

/**
 * Make a PUT request
 * @public
 * @function
 * @param {object} requestParams - Supports the exact parameters as Axios. See {@link https://github.com/axios/axios#axios-api here}
 * @example <caption>Creates a new resource or replaces a representation of the target resource with the request payload, with data from state.</caption>
 * put({
 *   url: state => `https://www.example.com/api/items/${state.id}`,
 *   data: state => state.data
 * });
 * @returns {Operation} - Function which takes state and returns a Promise
 */
declare function put(requestParams: any): (state: any) => AxiosPromise<any>;

/**
 * Ensures a path points at references.
 * @example
 * referencePath('key')
 * @param path - JSONPath referencing a point in `references`.
 */
export declare function referencePath(path: string): string;

export declare interface Resolvable<T> {
    (state: State): T;
}

declare type ResponseType_2 =
| 'arraybuffer'
| 'blob'
| 'document'
| 'json'
| 'text'
| 'stream'

export declare interface Selector<T> {
    (state: State): T;
}

/**
 * Picks out a value from source data.
 * Will return whatever JSONPath returns, which will always be an array.
 * If you need a single value use `sourceValue` instead.
 * @example
 * source('$.key')
 * @param  path - JSONPath referencing a point in `state`.
 */
export declare function source(path: string): Selector<Array<any>>;

/**
 * Picks out a single value from source data.
 * If a JSONPath returns more than one value for the reference, the first
 * item will be returned.
 * @example
 * sourceValue('$.key')
 * @param path - JSONPath referencing a point in `state`.
 */
export declare function sourceValue(path: string): Selector<Array<String | Object>>;

export declare function splitKeys(obj: object, keys: string[]): {}[];

export declare interface State {
    configuration: object;
    data: object;
    references?: Array<any>;
    index?: number;
}

/**
 * Ensures primitive data types are wrapped in an array.
 * Does not affect array objects.
 * @example
 * each(function(state) {
 *   return toArray( dataValue("path_of_array")(state) )
 * }, ...)
 * @param arg - Data required to be in an array
 */
export declare function toArray<T>(arg: T): T[];

export { }
