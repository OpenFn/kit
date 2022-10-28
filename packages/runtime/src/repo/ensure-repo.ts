import fs from 'node:fs/promises';

const pkg = {
  name: 'openfn-repo',
  description: 'A repository for modules used by the openfn runtime',
  private: true,
  author: 'Open Function Group <admin@openfn.org>',
  version: '1.0.0',
};

export default async (path: string) => {
  // ensure a repo with a package.json exists at this path
  await fs.mkdir(path, { recursive: true });

  // is there a package json>
  const pkgPath = `${path}/package.json`;
  try {
    const raw = await fs.readFile(pkgPath, 'utf8');
    JSON.parse(raw);
    console.log('Repo exists');
  } catch (e) {
    console.log('Writing package.json');
    fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2));
  }
  return true;
};
