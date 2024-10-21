import path from 'node:path';
import run from '@openfn/runtime';
import compiler from '@openfn/compiler';

const execute = async (job: string, state: any, adaptor = 'common') => {
  // compile with common and dumb imports
  const options = {
    'add-imports': {
      adaptors: [
        {
          name: `@openfn/language-${adaptor}`,
          exportAll: true,
        },
      ],
    },
  };
  const compiled = compiler(job, options);
  // console.log(compiled);

  const result = await run(compiled, state, {
    // preload the linker with some locally installed modules
    linker: {
      modules: {
        '@openfn/language-common': {
          path: path.resolve('node_modules/@openfn/language-common'),
        },
        '@openfn/language-http': {
          path: path.resolve('node_modules/@openfn/language-http'),
        },
      },
    },
  });

  return result;
};

export default execute;
