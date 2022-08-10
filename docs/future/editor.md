## Editor

### Monaco

**Adding libraries to Moanco**

```ts
monaco.languages.typescript.typescriptDefaults.addExtraLib('const arr = [];')
```

**Hiding Editor Lines**

https://github.com/microsoft/monaco-editor/issues/45#issuecomment-1159168677

```ts
interface IMyStandaloneCodeEditor extends monaco.editor.IStandaloneCodeEditor {
  setHiddenAreas(range: monaco.IRange[]): void;
}

...

const casted = editor as IMyStandaloneCodeEditor;
const range = new monaco.Range(1, 0, 1, 0);
casted.setHiddenAreas([range]);
```