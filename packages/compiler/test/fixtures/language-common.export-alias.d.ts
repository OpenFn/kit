declare const axios: any;

/**
 * Recursively resolves objects that have resolvable values (functions), but
 * omits HTTP request specific modules like `FormData`.
 * @public
 * @function
 * @param {object} value - data
 * @returns {<Operation>}
 */
declare function expandRequestReferences(params: any): (state: any) => any;
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
declare function get(requestParams: any): (state: State) => any;
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
declare function post(requestParams: any): (state: any) => any;
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
declare function del(requestParams: any): (state: any) => any;

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
declare function head(requestParams: any): (state: any) => any;
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
declare function put(requestParams: any): (state: any) => any;
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
declare function patch(requestParams: any): (state: any) => any;
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
declare function options(requestParams: any): (state: any) => any;

declare const http_axios: typeof axios;
declare const http_expandRequestReferences: typeof expandRequestReferences;
declare const http_get: typeof get;
declare const http_post: typeof post;
declare const http_head: typeof head;
declare const http_put: typeof put;
declare const http_patch: typeof patch;
declare const http_options: typeof options;
declare namespace http {
  export {
    http_axios as axios,
    del as delete,
    http_expandRequestReferences as expandRequestReferences,
    http_get as get,
    http_post as post,
    http_head as head,
    http_put as put,
    http_patch as patch,
    http_options as options,
  };
}

interface State {
    configuration: object;
    data: object;
    references?: Array<any>;
    index?: number;
}
interface Resolvable<T> {
    (state: State): T;
}
declare type DataSource = object | string | Selector<object | string>;
interface Operation<T = Promise<State> | State> {
    (state: State): T;
}
interface Selector<T> {
    (state: State): T;
}
declare type Field = [string, string | object | any[]];
/**
 * Execute a sequence of operations.
 * Main outer API for executing expressions.
 * @example
 *  execute(
 *    create('foo'),
 *    delete('bar')
 *  )
 */
declare function execute(...operations: Array<Operation>): Operation;
/**
 * alias for "fn()"
 */
declare function alterState(func: Operation): Operation;
/**
 * Creates a custom step (or operation) for more flexible job writing.
 * @example
 * fn(state => {
 *   // do some things to state
 *   return state;
 * });
 */
declare function fn(func: Operation): Operation;
/**
 * Picks out a single value from source data.
 * If a JSONPath returns more than one value for the reference, the first
 * item will be returned.
 * @example
 * sourceValue('$.key')
 * @param path - JSONPath referencing a point in `state`.
 */
declare function sourceValue(path: string): Selector<Array<String | Object>>;
/**
 * Picks out a value from source data.
 * Will return whatever JSONPath returns, which will always be an array.
 * If you need a single value use `sourceValue` instead.
 * @example
 * source('$.key')
 * @param  path - JSONPath referencing a point in `state`.
 */
declare function source(path: string): Selector<Array<any>>;
/**
 * Remove prepending `$.`, `$` or `.`, in order to ensure the root of the
 * path starts with `$.data.`
 * @example
 * dataPath('key')
 * @param path - JSONPath referencing a point in `data`.
 */
declare function dataPath(path: string): string;
/**
 * Picks out a single value from the source data object—usually `state.data`.
 * If a JSONPath returns more than one value for the reference, the first
 * item will be returned.
 * @example
 * dataValue('key')
 * @param path - JSONPath referencing a point in `data`.
 */
declare function dataValue(path: string): Selector<(Object | String)[]>;
/**
 * Ensures a path points at references.
 * @example
 * referencePath('key')
 * @param path - JSONPath referencing a point in `references`.
 */
declare function referencePath(path: string): string;
/**
 * Picks out the last reference value from source data.
 * @example
 * lastReferenceValue('key')
 * @param path - JSONPath referencing a point in `references`.
 */
declare function lastReferenceValue(path: string): Selector<(Object | String)[]>;
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
declare function asData(data: DataSource, state: State): any;
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
declare function each(dataSource: DataSource, operation: Function): Operation;
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
declare const beta: {
    each: (dataSource: DataSource, operation: Operation) => Operation;
};
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
declare function combine(...operations: Array<Operation>): Operation;
/**
 * Adds data from a target object
 * @example
 * join('$.key','$.data','newKey')
 * @function
 * @param targetPath - Target path
 * @param sourcePath - Source path
 * @param targetKey - Target Key
 */
declare function join(targetPath: string, sourcePath: string, targetKey: string): Operation;
/**
 * Recursively resolves objects that have resolvable values (functions).
 * @function
 * @param value - data
 * @param [skipFilter] - a function which returns true if a value should be skipped
 */
declare function expandReferences(value: any[] | object | Function, skipFilter?: (val: any) => Boolean): Selector<any>;
/**
 * Returns a key, value pair in an array.
 * @example
 * field('destination_field_name__c', 'value')
 * @param key - Name of the field
 * @param value - The value itself or a sourceable operation.
 */
declare function field(key: string, value: any): Field;
/**
 * Zips key value pairs into an object.
 * @example
 *  fields(list_of_fields)
 * @param fields - a list of fields
 */
declare function fields(...fields: Field[]): object;
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
declare function merge(dataSource: string, fields: object): Operation;
/**
 * Returns the index of the current array being iterated.
 * To be used with `each` as a data source.
 * @example
 * index()
 */
declare function index(): Selector<number | undefined>;
/**
 * Turns an array into a string, separated by X.
 * @example
 * field("destination_string__c", function(state) {
 *   return arrayToString(dataValue("path_of_array")(state), ', ')
 * })
 * @param arr - Array of toString'able primatives.
 * @param separator - Separator string.
 */
declare function arrayToString(arr: any[], separator: string): string[];
/**
 * Ensures primitive data types are wrapped in an array.
 * Does not affect array objects.
 * @example
 * each(function(state) {
 *   return toArray( dataValue("path_of_array")(state) )
 * }, ...)
 * @param arg - Data required to be in an array
 */
declare function toArray<T>(arg: T): T[];
/**
 * Prepares next state
 * @example
 * composeNextState(state, response)
 * @param state - state
 * @param response - Response to be added
 */
declare function composeNextState(state: State, response: any): State;
/**
 * Subsitutes underscores for spaces and proper-cases a string
 * @public
 * @example
 * field("destination_string__c", humanProper(state.data.path_to_string))
 * @function
 * @param str - String that needs converting
 */
declare function humanProper(str: string): string;
declare function splitKeys(obj: object, keys: string[]): {}[];

export { DataSource, Field, Operation, Resolvable, Selector, State, alterState, arrayToString, asData, beta, combine, composeNextState, dataPath, dataValue, each, execute, expandReferences, field, fields, fn, http, humanProper, index, join, lastReferenceValue, merge, referencePath, source, sourceValue, splitKeys, toArray };
