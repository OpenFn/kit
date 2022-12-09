import React, { useState, useCallback, useEffect } from 'react';
import Monaco from "@monaco-editor/react";
import type { EditorProps as MonacoProps } from  "@monaco-editor/react/lib/types";

import meta from '../metadata.json' assert { type: 'json'};

const code = `import { upsert } from '@openfn/language-salesforce';

upsert();`

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
   * @param {String} externalId - ID.
   * @param {Object} attrs - Field attributes for the new object.
   * @param {State} state - Runtime state.
   * @returns {Operation}
   */
  export function upsert(sObject: string, externalId: string, attrs?: any, state?: any): Operation;
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
  // quickSuggestions: {
  //   other: false,
  //   comments: false,
  //   strings: false
  // },
};

/*
 * My provider will do a few things
 * 1) Only suggest from the language adaptor (need to unregister the default provider I think)
 *       - between options.suggest.showKeywords and compilerOptions.nolib, we can hide most default suggestions
 * 2) Use metadata to suggesdt string values
 */

// return a list of sobject completion items
const getSObjects = () => {
  // TODO instead of this function, we need to map this based on a path
  // The path needs to say "where are the strings to insert"
  // Is it just a json path? jq query?
  const suggestions = meta.entities.filter(({ system }) => !system).map(({ name }) => ({
    label: `"${name}"`,
    kind: monaco.languages.CompletionItemKind.Text,
    insertText: `"${name}"`
  }))

  return {
    // https://microsoft.github.io/monaco-editor/api/interfaces/monaco.languages.CompletionItem.html
    suggestions
  }
}

const getFields = (sobjectName: string) => {
  // TODO instead of this function, we need to map this based on a path
  // The path needs to say "where are the strings to insert"
  // Is it just a json path? jq query?
  const obj = meta.entities.find(({ name }) => name === sobjectName );
  const suggestions = obj?.entities.map(({ name }) => ({
    label: `"${name}"`,
    kind: monaco.languages.CompletionItemKind.Text,
    insertText: `"${name}"`
  }))

  return {
    // https://microsoft.github.io/monaco-editor/api/interfaces/monaco.languages.CompletionItem.html
    suggestions
  }
}


const getCompletionProvider = (monaco) => ({
	provideCompletionItems: async function (model, position, context) {
    // model is ITextModel
    // https://microsoft.github.io/monaco-editor/api/interfaces/monaco.editor.ITextModel.html
    console.log(model)
    // console.log(position)
    // console.log(context)
    
    // So we need to work out where we are in the model. How do we do this?
    // I need to get the symbol (if there is one)
    const workerFactory = await monaco.languages.typescript.getJavaScriptWorker();
    const worker = await workerFactory();
    // console.log(worker)

    // So if we're on a function, this will return a definition
    // Tells us the container (@openfn/language-salesforce) and kind (function)
    // Sadly this is useless!!
    // const def = await worker.getDefinitionAtPosition('file:///job.js', model.getOffsetAt(position))
    // console.log(def);

    const help = await worker.getSignatureHelpItems('file:///job.js', model.getOffsetAt(position))
    console.log(help)

    const param = help.items[0].parameters[help.argumentIndex]

    // const param = help.items[help.selectedItemIndex][0].paramters
    console.log(param)
    // TODO this needs to become a lookup against metadata, drive by docs. Somehow.
    if (param.name === 'sObject') {
      // Difficulty: this should ONLY show the sobejct strings, but sadly it shows everything
      // I want to show ONLY this completion provider, not the others
      return getSObjects();
    }
    if (param.name === 'externalId') {
      // How do we get the sobject name? It's not in the singature
      // We're going to have to look in the source
      // previous token is ,
      // we need the one before
      // const start = model.getPositionAt(help.applicableSpan.start)
      // const end = model.getPositionAt(help.applicableSpan.start + help.applicableSpan.length)
      // console.log(start)
      // console.log(end)
      // const allArgs = model.getValue().substring(help.applicableSpan.start, help.applicableSpan.start + help.applicableSpan.length)
      // console.log(' > ', allArgs)
      
      // luckily getting the first argument is easy, but this doesn't scale well
      // Really, we need a helper that maps each parameter to the value, if known
      // This actually assumes there's not loads of whitespace
      const firstArg = model.getWordAtPosition(model.getPositionAt(help.applicableSpan.start + 1))
      console.log(firstArg)
      return getFields(firstArg.word);
    }

    // Which is fun, but I need to know that I'm in a paramter. hm.
  

    // are we on the first parameter of upsert?

    // console.log(' ** provider  called **')
		// // find out if we are completing a property in the 'dependencies' object.
		// var textUntilPosition = model.getValueInRange({
		// 	startLineNumber: 1,
		// 	startColumn: 1,
		// 	endLineNumber: position.lineNumber,
		// 	endColumn: position.column
		// });
		// var match = textUntilPosition.match(
		// 	/"dependencies"\s*:\s*\{\s*("[^"]*"\s*:\s*"[^"]*"\s*,\s*)*([^"]*)?$/
		// );
		// if (!match) {
		// 	return { suggestions: [] };
		// }
		// var word = model.getWordUntilPosition(position);
		// var range = {
		// 	startLineNumber: position.lineNumber,
		// 	endLineNumber: position.lineNumber,
		// 	startColumn: word.startColumn,
		// 	endColumn: word.endColumn
		// };
		return new Promise((r) => r({
      // https://microsoft.github.io/monaco-editor/api/interfaces/monaco.languages.CompletionList.html
			suggestions: [
        // TODO this needs t
        {
          // https://microsoft.github.io/monaco-editor/api/interfaces/monaco.languages.CompletionItem.html
          label: 'jam',
          kind: monaco.languages.CompletionItemKind.Text,
          insertText: 'jamjar'
        },
      ], //createDependencyProposals(range)

		}));
	}
});


const Editor = () => {

  const handleEditorDidMount = useCallback((editor: any, monaco: typeof Monaco) => {
    // console.log(editor)
    // console.log(editor.getModel()); // text model?
    // console.log(monaco.languages)
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
    // onChange={handleSourceChange}
  />)
}

export default Editor;