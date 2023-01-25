import React, { useState, useCallback, useEffect } from 'react';
import Monaco from "@monaco-editor/react";
import type { EditorProps as MonacoProps } from  "@monaco-editor/react/lib/types";

import meta from '../metadata-dhis2.json' assert { type: 'json'};
import jp from 'jsonpath'


type Y = {
  jam: string
}

type X = {
  /** blah */
  a: string;
  y?: Y[]
}

const obj: X = {
  a: "jam",
  y: [{ jam: 'jar' }]
}

const code = `import { create } from '@openfn/language-dhis2';

// hello world
const obj: X = {
  a: "jam",
  y: [{  }]
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
      noLib: true,
    });

    monaco.languages.typescript.javascriptDefaults.setExtraLibs([{ content: dts_env }, { content: dts_create }]);
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