import React, { useState, useCallback, useEffect } from 'react';
import Monaco from "@monaco-editor/react";
import type { EditorProps as MonacoProps } from  "@monaco-editor/react/lib/types";

import meta from '../metadata-dhis2.json' assert { type: 'json'};
import jp from 'jsonpath'

// We may need to keep some core es5 langauge constructs
// We can probably just about keep these out ofcode complete
// It's all a bit of a pain though...
// https://github.com/microsoft/TypeScript/blob/main/lib/lib.es5.d.ts
const dts_es5 = `
interface Array<T> {
  /**
   * Gets or sets the length of the array. This is a number one higher than the highest index in the array.
   */
  length: number;
  /**
   * Returns a string representation of an array.
   */
  toString(): string;
  /**
   * Returns a string representation of an array. The elements are converted to string using their toLocaleString methods.
   */
  toLocaleString(): string;
  /**
   * Removes the last element from an array and returns it.
   * If the array is empty, undefined is returned and the array is not modified.
   */
  pop(): T | undefined;
  /**
   * Appends new elements to the end of an array, and returns the new length of the array.
   * @param items New elements to add to the array.
   */
  push(...items: T[]): number;
  /**
   * Combines two or more arrays.
   * This method returns a new array without modifying any existing arrays.
   * @param items Additional arrays and/or items to add to the end of the array.
   */
  concat(...items: ConcatArray<T>[]): T[];
  /**
   * Combines two or more arrays.
   * This method returns a new array without modifying any existing arrays.
   * @param items Additional arrays and/or items to add to the end of the array.
   */
  concat(...items: (T | ConcatArray<T>)[]): T[];
  /**
   * Adds all the elements of an array into a string, separated by the specified separator string.
   * @param separator A string used to separate one element of the array from the next in the resulting string. If omitted, the array elements are separated with a comma.
   */
  join(separator?: string): string;
  /**
   * Reverses the elements in an array in place.
   * This method mutates the array and returns a reference to the same array.
   */
  reverse(): T[];
  /**
   * Removes the first element from an array and returns it.
   * If the array is empty, undefined is returned and the array is not modified.
   */
  shift(): T | undefined;
  /**
   * Returns a copy of a section of an array.
   * For both start and end, a negative index can be used to indicate an offset from the end of the array.
   * For example, -2 refers to the second to last element of the array.
   * @param start The beginning index of the specified portion of the array.
   * If start is undefined, then the slice begins at index 0.
   * @param end The end index of the specified portion of the array. This is exclusive of the element at the index 'end'.
   * If end is undefined, then the slice extends to the end of the array.
   */
  slice(start?: number, end?: number): T[];
  /**
   * Sorts an array in place.
   * This method mutates the array and returns a reference to the same array.
   * @param compareFn Function used to determine the order of the elements. It is expected to return
   * a negative value if the first argument is less than the second argument, zero if they're equal, and a positive
   * value otherwise. If omitted, the elements are sorted in ascending, ASCII character order.
   */
  sort(compareFn?: (a: T, b: T) => number): this;
  /**
   * Removes elements from an array and, if necessary, inserts new elements in their place, returning the deleted elements.
   * @param start The zero-based location in the array from which to start removing elements.
   * @param deleteCount The number of elements to remove.
   * @returns An array containing the elements that were deleted.
   */
  splice(start: number, deleteCount?: number): T[];
  /**
   * Removes elements from an array and, if necessary, inserts new elements in their place, returning the deleted elements.
   * @param start The zero-based location in the array from which to start removing elements.
   * @param deleteCount The number of elements to remove.
   * @param items Elements to insert into the array in place of the deleted elements.
   * @returns An array containing the elements that were deleted.
   */
  splice(start: number, deleteCount: number, ...items: T[]): T[];
  /**
   * Inserts new elements at the start of an array, and returns the new length of the array.
   * @param items Elements to insert at the start of the array.
   */
  unshift(...items: T[]): number;
  /**
   * Returns the index of the first occurrence of a value in an array, or -1 if it is not present.
   * @param searchElement The value to locate in the array.
   * @param fromIndex The array index at which to begin the search. If fromIndex is omitted, the search starts at index 0.
   */
  indexOf(searchElement: T, fromIndex?: number): number;
  /**
   * Returns the index of the last occurrence of a specified value in an array, or -1 if it is not present.
   * @param searchElement The value to locate in the array.
   * @param fromIndex The array index at which to begin searching backward. If fromIndex is omitted, the search starts at the last index in the array.
   */
  lastIndexOf(searchElement: T, fromIndex?: number): number;
  /**
   * Determines whether all the members of an array satisfy the specified test.
   * @param predicate A function that accepts up to three arguments. The every method calls
   * the predicate function for each element in the array until the predicate returns a value
   * which is coercible to the Boolean value false, or until the end of the array.
   * @param thisArg An object to which the this keyword can refer in the predicate function.
   * If thisArg is omitted, undefined is used as the this value.
   */
  every<S extends T>(predicate: (value: T, index: number, array: T[]) => value is S, thisArg?: any): this is S[];
  /**
   * Determines whether all the members of an array satisfy the specified test.
   * @param predicate A function that accepts up to three arguments. The every method calls
   * the predicate function for each element in the array until the predicate returns a value
   * which is coercible to the Boolean value false, or until the end of the array.
   * @param thisArg An object to which the this keyword can refer in the predicate function.
   * If thisArg is omitted, undefined is used as the this value.
   */
  every(predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: any): boolean;
  /**
   * Determines whether the specified callback function returns true for any element of an array.
   * @param predicate A function that accepts up to three arguments. The some method calls
   * the predicate function for each element in the array until the predicate returns a value
   * which is coercible to the Boolean value true, or until the end of the array.
   * @param thisArg An object to which the this keyword can refer in the predicate function.
   * If thisArg is omitted, undefined is used as the this value.
   */
  some(predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: any): boolean;
  /**
   * Performs the specified action for each element in an array.
   * @param callbackfn  A function that accepts up to three arguments. forEach calls the callbackfn function one time for each element in the array.
   * @param thisArg  An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value.
   */
  forEach(callbackfn: (value: T, index: number, array: T[]) => void, thisArg?: any): void;
  /**
   * Calls a defined callback function on each element of an array, and returns an array that contains the results.
   * @param callbackfn A function that accepts up to three arguments. The map method calls the callbackfn function one time for each element in the array.
   * @param thisArg An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value.
   */
  map<U>(callbackfn: (value: T, index: number, array: T[]) => U, thisArg?: any): U[];
  /**
   * Returns the elements of an array that meet the condition specified in a callback function.
   * @param predicate A function that accepts up to three arguments. The filter method calls the predicate function one time for each element in the array.
   * @param thisArg An object to which the this keyword can refer in the predicate function. If thisArg is omitted, undefined is used as the this value.
   */
  filter<S extends T>(predicate: (value: T, index: number, array: T[]) => value is S, thisArg?: any): S[];
  /**
   * Returns the elements of an array that meet the condition specified in a callback function.
   * @param predicate A function that accepts up to three arguments. The filter method calls the predicate function one time for each element in the array.
   * @param thisArg An object to which the this keyword can refer in the predicate function. If thisArg is omitted, undefined is used as the this value.
   */
  filter(predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: any): T[];
  /**
   * Calls the specified callback function for all the elements in an array. The return value of the callback function is the accumulated result, and is provided as an argument in the next call to the callback function.
   * @param callbackfn A function that accepts up to four arguments. The reduce method calls the callbackfn function one time for each element in the array.
   * @param initialValue If initialValue is specified, it is used as the initial value to start the accumulation. The first call to the callbackfn function provides this value as an argument instead of an array value.
   */
  reduce(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T): T;
  reduce(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T, initialValue: T): T;
  /**
   * Calls the specified callback function for all the elements in an array. The return value of the callback function is the accumulated result, and is provided as an argument in the next call to the callback function.
   * @param callbackfn A function that accepts up to four arguments. The reduce method calls the callbackfn function one time for each element in the array.
   * @param initialValue If initialValue is specified, it is used as the initial value to start the accumulation. The first call to the callbackfn function provides this value as an argument instead of an array value.
   */
  reduce<U>(callbackfn: (previousValue: U, currentValue: T, currentIndex: number, array: T[]) => U, initialValue: U): U;
  /**
   * Calls the specified callback function for all the elements in an array, in descending order. The return value of the callback function is the accumulated result, and is provided as an argument in the next call to the callback function.
   * @param callbackfn A function that accepts up to four arguments. The reduceRight method calls the callbackfn function one time for each element in the array.
   * @param initialValue If initialValue is specified, it is used as the initial value to start the accumulation. The first call to the callbackfn function provides this value as an argument instead of an array value.
   */
  reduceRight(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T): T;
  reduceRight(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T, initialValue: T): T;
  /**
   * Calls the specified callback function for all the elements in an array, in descending order. The return value of the callback function is the accumulated result, and is provided as an argument in the next call to the callback function.
   * @param callbackfn A function that accepts up to four arguments. The reduceRight method calls the callbackfn function one time for each element in the array.
   * @param initialValue If initialValue is specified, it is used as the initial value to start the accumulation. The first call to the callbackfn function provides this value as an argument instead of an array value.
   */
  reduceRight<U>(callbackfn: (previousValue: U, currentValue: T, currentIndex: number, array: T[]) => U, initialValue: U): U;

  [n: number]: T;
}

interface ArrayConstructor {
  new(arrayLength?: number): any[];
  new <T>(arrayLength: number): T[];
  new <T>(...items: T[]): T[];
  (arrayLength?: number): any[];
  <T>(arrayLength: number): T[];
  <T>(...items: T[]): T[];
  isArray(arg: any): arg is any[];
  readonly prototype: any[];
}

// don't declare the array var to keep it out of code complete
//declare var Array: ArrayConstructor;`

const code = `import { create } from '@openfn/language-dhis2';

// hello world
const obj: X = {
  a: "jam",
  y: [{  } ]
}
const jam = 'jar';

create('trackedEntityInstance',  {});

create('trackedEntityInstance',  { 
    orgUnit: "Rp268JB6Ne4",
    attributes: [{

    }]
 })
 `;

// const code = `import { upsert } from '@openfn/language-salesforce';

// upsert()`;

// const code = `import { upsert } from '@openfn/language-salesforce';

// upsert()

// upsert("vera__Beneficiary__c", );

// upsert("vera__Beneficiary__c", "vera__GHI_ID_Number__c", {

// });`

const dts_env = `
// hacks to remove undefined and globalThis from code suggest
// https://github.com/microsoft/monaco-editor/issues/2018
declare module undefined 
`

// Provide a fake dts for salesforce
// This is copied from adaptors, but looks a but sus!
const dts_upsert = `
declare module '@openfn/language-salesforce' {
  /**
   * Upsert an object.
   * @public
   * @example
   * upsert('obj_name', 'ext_id', {
   *   attr1: "foo",
   *   attr2: "bar"
   * })
   * @constructor
   * @param {String} sObject - API name of the sObject.
   * @paramLookup sObject $.entities[?(@.type=="sobject" && !@.system)].name
   * @param {String} externalId - ID.
   * @paramLookup externalId $.entities[?(@.name=="{{args.sObject}}")].entities[?(@.meta.externalId)].name
   * @param {Object} attrs - Field attributes for the new object.
   * @paramLookup attrs $.entities[?(@.name=="{{args.sObject}}")].entities[?(!@.meta.externalId)]
   * @param {State} state - Runtime state.
   * @returns {Operation}
   */
  export function upsert(sObject: string, externalId: string, attrs?: object, state?: any): Operation;
}
`

// TODO let's pretend that the adaptor ships this type definition
const dts_create = `
// TODO are attributes bound to anything, like a particular org id or entity type?
type Dhis2Attribute = {
  
  /**
   * The attribute id
   * @lookup $.attributes[*]
   */
  attribute: string;

  value: any;
}

type Y = {
  jam: string
}

type X = {
  /** blah */
  a: string;
  y?: Y[]
}

type Dhis2Data = {
  /**
   * The id of an organisation unit
   * @lookup $.orgUnits[*]
   */
  orgUnit?: string;

  /**
   * Tracked instance id
   */
  trackedEntityInstance?: string;

  /**
   * Tracked instance type
   * @lookup $.trackedEntityTypes[*]
   */
  trackedEntityType?: string;

  /**
   * List of attributes
   */
  attributes?: Dhis2Attribute[];
};

declare module '@openfn/language-dhis2' {
 /**
  * Create a record
  * @public
  * @constructor
  * @param {string} resourceType - Type of resource to create.
  * @paramlookup resourceType $.resourceTypes[*]
  * @param {Dhis2Data} data - Data that will be used to create a given instance of resource.
  * @param {Object} [options] - Optional options to define URL parameters via params.
  * @param {function} [callback] - Optional callback to handle the response
  * @returns {Operation}
  * 
  */
 export function create(resourceType: string, data: Dhis2Data, options = {}, callback = false): Operation;
}
`
const options: MonacoProps['options'] = {
  dragAndDrop: false,
  lineNumbersMinChars: 3,
  minimap: {
    enabled: false
  },
  scrollBeyondLastLine: false,
  showFoldingControls: 'always',
  
  // Hide the right-hand "overview" ruler
  overviewRulerLanes: 0,
  overviewRulerBorder: false,

  codeLens: false,
  
  wordBasedSuggestions: false, 

  // parameterHints: {
  //   enabled: false
  // },
  suggest: {
    // Hide keywords
    showKeywords: false,
    showModules: false, // hides global this
    showFiles: false, // This hides property names ??
    // showProperties: false, // seems to hide consts but show properties??
    showClasses: false,
    showInterfaces: false,
    showConstructors: false,

  }
};

const ensureArray = (x: any) => Array.isArray(x) ? x : [x];

const query = (jsonPath:string) => ensureArray(jp.query(meta, jsonPath));

// Run a jsonpath query and return the results
const lookupTextSuggestions = (jsonPath:string) => {
  const suggestions = query(jsonPath).map((s:string) => {
    let label;
    let insertText;
    if (typeof s  === 'string') {
      insertText = label = `"${s}"`;
    } else {
      label = s.label || s.name;
      insertText = `"${s.name}"`; // presumptuous - need a better system for this
    }
    return ({
      label,
      kind: monaco.languages.CompletionItemKind.Text,
      insertText,
      // Boost this up the autocomplete list
      sortText: `00-${label}`
    })
  });

  return {
    // https://microsoft.github.io/monaco-editor/api/interfaces/monaco.languages.CompletionItem.html
    suggestions
  }
}

const lookupValueSuggestions = (jsonPath:string) => {
  const suggestions = query(jsonPath).map((s:string) => {
    let label;
    let insertText;
    if (typeof s  === 'string') {
      insertText = label = `"${s}"`;
    } else {
      label = s.label || s.name;
      // For DHIS2 it might be nice to comment in the original value
      // is this a user preferece? Language preference? Should we always do this?
      insertText = `"${s.name}" /*${s.label}*/`; // presumptuous - need a better system for this
    }
    return ({
      label,
      kind: monaco.languages.CompletionItemKind.Value,
      insertText,
      detail: s.label ? s.name : '',
      // Boost this up the autocomplete list
      sortText: `00-${label}`
    })
  });

  return {
    // https://microsoft.github.io/monaco-editor/api/interfaces/monaco.languages.CompletionItem.html
    suggestions
  }
}

const lookupPropertySuggestions = (jsonPath: string) => {
  const suggestions = query(jsonPath).map((prop: object) => {
    const label = `${prop.label || prop.name}`;
    return {
      // https://microsoft.github.io/monaco-editor/api/interfaces/monaco.languages.CompletionItem.html#kind
      label,
      kind: monaco.languages.CompletionItemKind.Property,
      insertText: `"${prop.name}":`,
      detail: `${prop.name} (${prop.datatype})`,
      // Boost this up the autocomplete list
      sortText: `00-${label}`
    };
  });

  return {
    // https://microsoft.github.io/monaco-editor/api/interfaces/monaco.languages.CompletionItem.html
    suggestions
  }

}

// Returns an indexed object of argument names with known values
// help is the parameter help object
// model is the text model
const extractArguments = (help, model) => {
  const allArgs = model.getValue().substring(help.applicableSpan.start, help.applicableSpan.start + help.applicableSpan.length)
  return allArgs.split(',').map(a => a.trim()).reduce((acc, arg, index) => {
    // Only return string literal values (for now at least)
    if (arg.startsWith("'") || arg.startsWith('"')) {
      const param = help.items[0].parameters[index];
      acc[param.name] = arg.substring(1, arg.length-1)
    }
    return acc;
  }, {})
}

const replacePlaceholders = (args, expression) => {
  const placeholders = expression.match(/{{.+}}/)
  let newExpression = expression;
  if (placeholders) {
    const allOk = placeholders.every((q) => {
      const exp = q.substring(2, q.length-2);
      const [_args, name] = exp.split('.')
      const val = args[name]
      if (val) {
        newExpression = newExpression.replace(q, val)
        return true;
      }
      return false;
    });
    if (allOk) {
      return newExpression
    }
    // If something went wrong with the expression, forget the whole thing
    return null;
  }
  return expression;
};


// find lookups for a parameter based on its lookup
// (this is basically the original logic)
const getParameterValueLookup = async (worker, model, offset) => {
  const help = await worker.getSignatureHelpItems('file:///job.js', offset)

  if (help && help.items.length) {
    const param = help.items[0].parameters[help.argumentIndex]
    console.log(param)

    if (param) {
      // Check the lookup rule for this paramter
      const nameRe = new RegExp(`^${param.name}`);
      const lookup = help.items[0].tags.find(({ name, text }) => {
        if (name.toLowerCase() == "paramlookup") {
          return nameRe.test(text[0].text);
        }
      });
      if (lookup) {
        // Check all the matching lookups to find the appropriate one
        // This is complicated because we may be inside an object definition with lookup values
        const [_name, ...e] = lookup.text[0].text.split(/\s/)
        const expression = e.join(' ');
        console.log(expression)
        // Parse this function call's arguments and map any values we have
        // Check the query expression for any placeholders (of the form arg.name)
        // If we have a valid expression, run it and return whatever results we get!
        const args = extractArguments(help, model);
        const finalExpression = replacePlaceholders(args, expression).trim()
        
        const { text, kind } = param.displayParts.at(-1)
        if (kind === 'keyword' && text === 'object') {
          // TODO I still wonder if we're better off generating a dts for this
          return lookupPropertySuggestions(finalExpression);  
        }
      
        return lookupTextSuggestions(finalExpression);
      }
    }
  }
}

// find lookups for an object
// this is the new stuff for dhis2
// This is quite robust now: find the symbol to the left, if it's a property,
// try to finda  matching lookup
// (this will even work outside of the signature if there's a type definition)
const getPropertyValueLookup = async (worker, model, offset) => {
  // find the word to the left
  const pos = findleftWord(model, offset);
  if (pos) {
    const info = await worker.getQuickInfoAtPosition('file:///job.js', pos)
    if (info?.kind === 'property' && info.tags) {
      const lookup = info.tags.find(({ name }) => name === 'lookup')
      if (lookup) {
        const path = lookup.text[0].text;
        // TODO - swap out placeholders
        return lookupValueSuggestions(path);
      }
    }
  }

}

// Find the word to the left of the offset
// TODO: this should abort if it hits a closing delimiter ]})
const findleftWord = (model, offset: number) => {
  let pos = offset;
  let word;
  while (pos > 0 && !word) {
    word = model.getWordAtPosition(model.getPositionAt(pos));
    if (word) {
      console.log('word: ', word)
      return pos;
    }
    pos  -=1
  }
}

const getCompletionProvider = (monaco) => ({
  // model is ITextModel
  // https://microsoft.github.io/monaco-editor/api/interfaces/monaco.editor.ITextModel.html
	provideCompletionItems: async function (model, position, context) {
    const offset = model.getOffsetAt(position);


    const workerFactory = await monaco.languages.typescript.getJavaScriptWorker();
    const worker = await workerFactory();

    
    let suggestions = await getPropertyValueLookup(worker, model, offset);
    if (!suggestions) {
      suggestions = await getParameterValueLookup(worker, model, offset)
    }
    return suggestions;
	}
});


const Editor = () => {

  const handleEditorDidMount = useCallback((editor: any, monaco: typeof Monaco) => {
    monaco.languages.registerCompletionItemProvider('javascript', getCompletionProvider(monaco))

    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      // This seems to be needed to track the modules in d.ts files
      allowNonTsExtensions: true,
      
      // Disables core js libs in code completion
      // Oh no, but it also seems to break type tracking on an array!!
      noLib: true,
    });

    monaco.languages.typescript.javascriptDefaults.setExtraLibs([
      { content: dts_es5 },
      { content: dts_env },
      { content: dts_create }
    ]);
  }, []);

  return (<Monaco
    defaultLanguage="javascript"
    loading=""
    theme="vs-dark"
    defaultPath="/job.js"
    value={code}
    options={options}
    onMount={handleEditorDidMount}
  />)
}

export default Editor;