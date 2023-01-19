import React, { useState, useCallback, useEffect } from 'react';
import Monaco from "@monaco-editor/react";
import type { EditorProps as MonacoProps } from  "@monaco-editor/react/lib/types";

import meta from '../metadata.json' assert { type: 'json'};
import jp from 'jsonpath'

// type X = {
//   name: string;
//   age: number;
// }

// const x: X = {  }

const code = `import { upsert } from '@openfn/language-salesforce';

upsert()`;

// const code = `import { upsert } from '@openfn/language-salesforce';

// upsert()

// upsert("vera__Beneficiary__c", );

// upsert("vera__Beneficiary__c", "vera__GHI_ID_Number__c", {

// });`

// Provide a fake dts for salesforce
// This is copied from adaptors, but looks a but sus!
const dts = `
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
   * @param {State} state - Runtime state.
   * @paramLookup attrs $.entities[?(@.name=="{{args.sObject}}")].entities[?(!@.meta.externalId)]
   * @returns {Operation}
   */
  export function upsert(sObject: string, externalId: string, attrs?: object, state?: any): Operation;
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
  const suggestions = query(jsonPath).map((s:string) => ({
    label: `"${s}"`,
    kind: monaco.languages.CompletionItemKind.Text,
    insertText: `"${s}"`
  }));

  return {
    // https://microsoft.github.io/monaco-editor/api/interfaces/monaco.languages.CompletionItem.html
    suggestions
  }
}

const lookupPropertySuggestions = (jsonPath: string) => {
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

    // This API gives us details about parameters defined in the signature AND gives us context
    const help = await worker.getSignatureHelpItems('file:///job.js', model.getOffsetAt(position))

    const param = help.items[0].parameters[help.argumentIndex]

    // Check the lookup rule for this paramter
    const nameRe = new RegExp(`^${param.name}`);
    const lookup = help.items[0].tags.find(({ name, text }) => {
      if (name == "paramLookup") {
        return nameRe.test(text[0].text);
      }
    });

    if (lookup) {
      const [_name, expression] = lookup.text[0].text.split(nameRe)
      // Parse this function call's arguments and map any values we have
      const args = extractArguments(help, model);
      // Check the query expression for any placeholders (of the form arg.name)
      const finalExpression = replacePlaceholders(args, expression).trim()
      // If we have a valid expression, run it and return whatever results we get!
      if (finalExpression) {
        // This is a real kludge - if this looks like an object type, use a different builder function
        const { text, kind } = param.displayParts.at(-1)
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

    monaco.languages.typescript.javascriptDefaults.setExtraLibs([{ content: dts }]);
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