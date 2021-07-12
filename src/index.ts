// @ts-ignore
import * as swagger2openapi from 'swagger2openapi';
// @ts-ignore
import * as mkdirp from 'mkdirp';
import { OpenAPIV3 } from 'openapi-types';
import * as _ from 'lodash';
// import * as fse from 'fs-extra';
import { IGenParmas } from './utils/typeDefinitions';
import { deleteFolderRecursive } from './utils/fsStream';
import { getTagWithPaths } from './utils/getTagWithPaths';
import { getOpenApiDoc } from './utils/getOpenApiDoc';
import { handleSchema } from './utils/handelSchema';
import { getApiContent } from './utils/apiContent';
import { genFileFromTag, genIndexForDir } from './utils/writeFileFromTag';

export async function gen(options: IGenParmas) {
  const {
    fetchModuleFile = `${__dirname}/defaultFetch.ts`,
    outputDir,
    pascalCase = true,
  } = options;

  // 生成openApiData文档
  let openApiData: OpenAPIV3.Document = await getOpenApiDoc(options);

  // 处理schema
  const { schemasClassCode, schemasTypesCode } = handleSchema({ pascalCase, openApiData });

  //解析openapiData文档，生成需要导出的代码和pathMap
  const { pathContentList, pathsCode, pathsMap } = await getApiContent({ openApiData, options });

  console.log(pathContentList);

  // 清空输出目录对应文件夹
  await deleteFolderRecursive(outputDir);

  // 新建输出文件夹
  await mkdirp(outputDir);

  // 生成tagWithPaths，根据tags生成文件时使用数据结构
  const tagWithPaths = getTagWithPaths(openApiData, pathsMap);

  // 根据tags生成对应目录及目录下的文件
  await genFileFromTag({
    schemasClassCode,
    fetchModuleFile,
    outputDir,
    tagWithPaths,
  });

  // 生成输出目录下的index.ts文件
  await genIndexForDir({
    pathsCode,
    outputDir,
    schemasTypesCode,
    schemasClassCode,
  });

  console.info(`Generate code successful in directory: ${outputDir}`);
}
