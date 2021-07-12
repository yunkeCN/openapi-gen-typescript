// @ts-ignore
import * as swagger2openapi from 'swagger2openapi';
// @ts-ignore
import * as mkdirp from 'mkdirp';
import * as fs from 'fs';
import * as path from 'path';
import { OpenAPIV3 } from 'openapi-types';
import { NotModifyCode } from './constants';
import * as _ from 'lodash';
import * as fse from 'fs-extra';
import { IGenParmas } from './utils/typeDefinitions';
import { deleteFolderRecursive } from './utils/fsStream';
import { format } from './utils/format';
import { getTagWithPaths } from './utils/getTagWithPaths';
import { getOpenApiDoc } from './utils/getOpenApiDoc';
import { handleSchema } from './utils/handelSchema';
import { getApiContent } from './utils/apiContent';

export async function gen(options: IGenParmas) {
  const {
    fetchModuleFile = `${__dirname}/defaultFetch.ts`,
    outputDir,
    pascalCase = true,
  } = options;

  let openApiData: OpenAPIV3.Document = await getOpenApiDoc(options);

  const { schemasClassCode, schemasTypesCode } = handleSchema({ pascalCase, openApiData });
  const { tags: allTags } = openApiData;

  const { pathContentList, pathsCode, pathsMap } = await getApiContent({ openApiData, options });
  console.log(pathContentList);

  await deleteFolderRecursive(outputDir);

  // generate code
  await mkdirp(outputDir);

  const tagWithPaths = getTagWithPaths(allTags, pathsMap);

  fse.outputJson(path.resolve(__dirname, 'allTags.json'), allTags, (err: any) => {
    console.log(err); // => null
  });
  fse.outputJson(path.resolve(__dirname, 'pathsMap.json'), pathsMap, (err: any) => {
    console.log(err); // => null
  });
  fse.outputJson(path.resolve(__dirname, 'tagWithPaths.json'), tagWithPaths, (err: any) => {
    console.log(err); // => null
  });

  await Promise.all(
    tagWithPaths.map(async currTag => {
      const currMap = currTag.pathsInCurrTag;
      if (Object.keys(currMap).length > 0) {
        const currTagNameDir = `${outputDir}/${currTag.name}`;
        await mkdirp(currTagNameDir);
        const namespaceNameArr: string[] = [];
        Object.keys(currMap).map((namespaceName: string) => {
          const { summary, code } = currMap[namespaceName];
          const pathCode = [
            `/**
            * @namespace ${namespaceName}
            * @summary ${summary}
            */\n`,
            `import fetchImpl from '${path
              .relative(currTagNameDir, fetchModuleFile)
              .replace(/\.ts$/, '')}';`
              .split(path.sep)
              .join('/'),
            schemasClassCode.length > 0 ? `import * as schemas from '../schemas';\n` : '\n',
            code,
          ].join('\n');
          namespaceNameArr.push(namespaceName);
          fs.writeFileSync(`${currTagNameDir}/${namespaceName}.ts`, format(pathCode));
        });
        const tagCode = [
          `/**
          * @description ${currTag.description}
          */\n`,
          ...namespaceNameArr.map(key => `import * as ${key} from './${key}';`),
          `\nexport {
            ${namespaceNameArr.join(',\n')}
          }`,
        ].join('\n');

        fs.writeFileSync(`${currTagNameDir}/index.ts`, format(tagCode));
      }
    }),
  );

  const typesCode = [
    NotModifyCode,
    `export namespace components { export namespace schemas { ${schemasTypesCode.join('\n')} } } `,
    `export namespace Api { ${pathsCode.join('\n')} } `,
  ].join('\n');

  fs.writeFileSync(`${outputDir}/index.ts`, format(typesCode));

  if (schemasClassCode.length > 0) {
    const schemasCode = [NotModifyCode, schemasClassCode.join('\n')].join('\n');
    fs.writeFileSync(`${outputDir}/schemas.ts`, format(schemasCode));
  }

  console.info(`Generate code successful in directory: ${outputDir}`);
}
