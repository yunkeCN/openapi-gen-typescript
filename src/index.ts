// @ts-ignore
import * as swagger2openapi from 'swagger2openapi';
// @ts-ignore
import * as mkdirp from 'mkdirp';
import { OpenAPIV3 } from 'openapi-types';
import * as _ from 'lodash';
import { IGenParmas } from './utils/type';
import { deleteFolderRecursive } from './utils/emptyDir';
import { getOpenApiDoc } from './utils/getOpenApiDoc';
import { handleSchema } from './utils/handelSchema';
import { genCodeArr } from './utils/getCodeFromPaths';
import { writeFileFromIFileCode } from './utils/fileStream';

export async function gen(options: IGenParmas) {
  const {
    fetchModuleFile = `${__dirname}/defaultFetch.ts`,
    outputDir,
    pascalCase = true,
  } = options;

  // 生成openApiData文档
  let openApiData: OpenAPIV3.Document = await getOpenApiDoc(options);

  const { fileCodeList, pathsCode } = await genCodeArr({ openApiData, options });

  const { schemasClassCode, schemasTypesCode } = handleSchema({ pascalCase, openApiData });

  await deleteFolderRecursive(outputDir);

  await writeFileFromIFileCode({
    outputDir,
    fileCodeList,
    fetchModuleFile,
    schemasClassCode,
    schemasTypesCode,
    pathsCode,
  });

  console.info(`Generate code successful in directory: ${outputDir}`);
}
