import React, { useState, useCallback, useEffect } from 'react';
import Monaco from "@monaco-editor/react";
import type { EditorProps as MonacoProps } from  "@monaco-editor/react/lib/types";

import meta from '../metadata-dhis2.json' assert { type: 'json'};
import jp from 'jsonpath'

const code = `import { create } from '@openfn/language-dhis2';

create('trackedEntityInstance',  {  })`;

// const code = `import { upsert } from '@openfn/language-salesforce';

// upsert()`;

// const code = `import { upsert } from '@openfn/language-salesforce';

// upsert()

// upsert("vera__Beneficiary__c", );

// upsert("vera__Beneficiary__c", "vera__GHI_ID_Number__c", {

// });`

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

const dts_create = `
// TODO let's pretend that the adaptor ships this type definition
type Dhis2Data = {
  /** The id of an organisation unit */
  orgUnit?: string;

  /** Tracked instance id */
  trackedEntityInstance?: string;

  trackedEntityType?: string;
};

declare module '@openfn/language-dhis2' {
 /**
  * Create a record
  * @public
  * @constructor
  * @param {string} resourceType - Type of resource to create.
  * @param {Dhis2Data} data - Data that will be used to create a given instance of resource.
  * @paramLookup data.orgUnit $.orgUnits[*]
  * @paramLookup data.trackedEntityType $.trackedEntityTypes[*]
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

  parameterHints: {
    enabled: false
  },
  suggest: {
    // Hide keywords
    showKeywords: false,
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
      detail: s.label ? s.name : ''
    })
  });

  return {
    // https://microsoft.github.io/monaco-editor/api/interfaces/monaco.languages.CompletionItem.html
    suggestions
  }
}

const lookupPropertySuggestions = (jsonPath: string) => {
  console.log('property suggest')
  const suggestions = query(jsonPath).map((prop: object) => {
    return {
      // https://microsoft.github.io/monaco-editor/api/interfaces/monaco.languages.CompletionItem.html#kind
      label: `${prop.label || prop.name}`,
      kind: monaco.languages.CompletionItemKind.Property,
      insertText: `"${prop.name}":`,
      detail: `${prop.name} (${prop.datatype})`
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
      // Flag that somethingwent weont
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

const getCompletionProvider = (monaco) => ({
	provideCompletionItems: async function (model, position, context) {
    const offset = model.getOffsetAt(position);

    // This really rough and inefficient function scans left for the
    // first word it can find. This may or may not be an actual property name
    const findLeftPropertyName = () => {
      let pos = offset;
      let word;
      while (pos > 0 && !word) {
        word = model.getWordAtPosition(model.getPositionAt(pos));
        if (word) {
          console.log('word: ', word)
          return word.word
        }
        pos  -=1
      }

    }

    // model is ITextModel
    // https://microsoft.github.io/monaco-editor/api/interfaces/monaco.editor.ITextModel.html

    const workerFactory = await monaco.languages.typescript.getJavaScriptWorker();
    const worker = await workerFactory();
    // console.log(worker)

    // So if we're on a function, this will return a definition
    // Tells us the container (@openfn/language-salesforce) and kind (function)
    // Sadly this is useless right now!!
    // const def = await worker.getDefinitionAtPosition('file:///job.js', model.getOffsetAt(position))
    // console.log(def);

    
    // How can I get the syntactic context of the cursor position?
    // const info = await worker.getQuickInfoAtPosition('file:///job.js', model.getOffsetAt(position))
    // if (info) {
    //   console.log('info', info)
    //   // if we're on a symbol already, don't bother to sugges anything (?)
    //   return;
    // }

    // This API gives us details about parameters defined in the signature AND gives us context
    const help = await worker.getSignatureHelpItems('file:///job.js', offset)
    console.log(help)
  
    const param = help.items[0].parameters[help.argumentIndex]
    
    // Check the lookup rule for this paramter
    const nameRe = new RegExp(`^${param.name}`);

    // TODO there may be many matching lookups for an object definition (dhis2)
    const lookups = help.items[0].tags.filter(({ name, text }) => {
      if (name.toLowerCase() == "paramlookup") {
        return nameRe.test(text[0].text);
      }
    });
    console.log(lookups)
    if (lookups.length) {
      // If looking up inside an object, this gets quite complicated
      // Am I looking for property names or property values right now?
      // My path inside the object could affect both lookups
      // If the name nas a . in it, it's a path
      let isPropertyValue;
      const left = findLeftPropertyName();
      let expression;

      // Check all the matching lookups to find the appropriate one
      // This is complicated because we may be inside an object definition with lookup values
      lookups.find((l: string) => {
        const [name, ...e] = l.text[0].text.split(/\s/)
        if (name.match(/\./)) {
          // the lookup is in a path
          const parts = name.split('.')
          parts.shift(); // first part is the parameter name, so ignore it
          if (parts[0] === left) {
            isPropertyValue = true;
            expression = e.join(' ');
            return true;
          }
        } else {
          expression = e.join(' ');
          return true;
        }
      });
      if (!expression) {
        return;
      }

      // Parse this function call's arguments and map any values we have
      const args = extractArguments(help, model);
      // Check the query expression for any placeholders (of the form arg.name)
      const finalExpression = replacePlaceholders(args, expression).trim()
      // If we have a valid expression, run it and return whatever results we get!
      if (finalExpression) {
        // This is a real kludge - if this looks like an object type, use a different builder function
        const { text, kind } = param.displayParts.at(-1)
        
        if (isPropertyValue) {
          return lookupValueSuggestions(finalExpression);  
        }

        if ( kind === 'keyword' && text === 'object') {
          return lookupPropertySuggestions(finalExpression);  
        }

        return lookupTextSuggestions(finalExpression);
      }
    }

    return { suggestions: [] };
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

    monaco.languages.typescript.javascriptDefaults.setExtraLibs([{ content: dts_create }]);
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