// @ts-ignore
import * as swagger2openapi from 'swagger2openapi';
// @ts-ignore
import * as mkdirp from 'mkdirp';
import { OpenAPIV3 } from 'openapi-types';
import * as _ from 'lodash';
import { IGenParmas } from './utils/type';
import { genCodes } from './utils/genCodes';
import { deleteFolderRecursive, writeFileFromIFileCode } from './utils/fileStream';
import { genPaths, genTags } from './utils/getFilePath';
import { getOpenApiDoc, handleSchema } from './utils/getInterfaceInfo';

export async function gen(options: IGenParmas) {
  const {
    fetchModuleFile = `${__dirname}/defaultFetch.ts`,
    outputDir,
    pascalCase = true,
  } = options;

  const openApiData: OpenAPIV3.Document = await getOpenApiDoc(options);

  const { fileCodeList, pathsCode } = await genCodes({ openApiData, options });

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

export const genDirWithPaths = genPaths;

export const genDirWithTags = genTags;
