import { createNullLogger } from './logger';

const nullLogger = createNullLogger();

export default (names: string[], log = nullLogger) =>
  names?.map((name) => {
    if (name.startsWith('@openfn/language-')) {
      return name;
    }
    const expanded = `@openfn/language-${name}`;
    log.debug(`Expanded adaptor ${name} to ${expanded}`);
    return expanded;
  });
