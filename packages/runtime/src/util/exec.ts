// Promisified wrapper around child_process.exec

import { promisify } from 'node:util';
import { exec } from 'node:child_process';

export default promisify(exec);
