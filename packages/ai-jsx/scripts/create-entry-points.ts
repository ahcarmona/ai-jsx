import { loadJsonFile } from 'load-json-file';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs/promises';
import _ from 'lodash';
import ts from 'typescript';

const currentPath = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(currentPath, '..', '..');
const pathToThisFile = path.relative(packageRoot, fileURLToPath(import.meta.url));

interface PackageJson {
  exports: Record<
    string,
    {
      import: {
        types: string;
        default: string;
      };
      require: {
        types: string;
        default: string;
      };
    }
  >;
}

const packageJson = await loadJsonFile<PackageJson>(path.resolve(packageRoot, 'package.json'));

async function writeFile(filePath: string, contents: string) {
  const dirname = path.dirname(filePath);
  await fs.mkdir(dirname, { recursive: true });
  return fs.writeFile(
    path.join(packageRoot, filePath),
    `// Auto-generated by ${pathToThisFile}. Do not edit.
  
${contents}\n`,
    'utf8'
  );
}

for (const [exportKey, exportValue] of Object.entries(packageJson.exports)) {
  const importObj = exportValue.import;
  const requireObj = exportValue.require;

  const filePath = exportKey === '.' ? 'index' : exportKey.slice('./'.length);

  const getPathToDest = (dest: string) => `./${path.relative(path.dirname(filePath), dest)}`;
  // const exportPathFromRoot = path.relative()

  let typeFileContents;
  try {
    typeFileContents = await fs.readFile(importObj.types, 'utf8');
  } catch (e: any) {
    if (e.code === 'ENOENT') {
      console.log(
        `File ${e} did not exist. Is there an entry in package.json#exports that points to a non-existent file?`
      );
      throw e;
    }
  }
  const tsSourceFile = ts.createSourceFile(importObj.types, typeFileContents!, ts.ScriptTarget.Latest, true);
  const exportedIdentifiers: string[] = [];
  tsSourceFile.forEachChild((node) => {
    console.log('node', node);
    if (ts.isExportAssignment(node)) {
      exportedIdentifiers.push(node.expression.getText());
    }
  });

  if (!exportedIdentifiers.length) {
    throw new Error(`Could not find any exports for file ${importObj.types}`);
  }

  const typeFileDestContents = `import { ${exportedIdentifiers.join(', ')} } from './${getPathToDest(importObj.types)}';
  export { ${exportedIdentifiers.join(', ')} };
  `;

  await writeFile(`${filePath}.js`, `export * from '${getPathToDest(importObj.default)}'`);
  await writeFile(`${filePath}.d.ts`, typeFileDestContents);
  await writeFile(`${filePath}.cjs`, `module.exports = require('${getPathToDest(requireObj.default)}')`);
}
