const fs = require('node:fs');
const path = require('path');

fs.mkdirSync(path.resolve('dist'), { recursive: true });
