// @ts-ignore
import * as swagger2openapi from 'swagger2openapi';
import * as swaggerParser from '@apidevtools/swagger-parser';
// @ts-ignore
import * as mkdirp from 'mkdirp';
import * as camelcase from 'camelcase';
import { Options } from 'camelcase';
import * as fs from 'fs';
import * as path from 'path';
import { transform } from './schemaToTypes/transform';
import { format, deleteFolderRecursive } from './util';
import { IJsonSchema, OpenAPI, OpenAPIV3 } from 'openapi-types';
import { AllMethods, SortList, NotModifyCode, ETemplateCode } from './constants';
import ParameterBaseObject = OpenAPIV3.ParameterBaseObject;
import MediaTypeObject = OpenAPIV3.MediaTypeObject;
import OperationObject = OpenAPIV3.OperationObject;
import PathItemObject = OpenAPIV3.PathItemObject;
import ResponseObject = OpenAPIV3.ResponseObject;
import ReferenceObject = OpenAPIV3.ReferenceObject;
import ParameterObject = OpenAPIV3.ParameterObject;
import RequestBodyObject = OpenAPIV3.RequestBodyObject;
import Axios from 'axios';

type ContentObject = {
  [media: string]: MediaTypeObject;
};

type PostScriptReturnType =
  | {
      [key in ETemplateCode]: string;
    }
  | {
      [key: string]: string;
    };

function getCamelcase(urlPath: string, options?: Options): string {
  return camelcase(urlPath.split('/').join('_'), options);
}

function getCodeFromParameter(parameter: ParameterBaseObject, name: string): string {
  const { description, required } = parameter;

  let code = '';

  if (description) {
    code += `/* ${description} */\n`;
  }

  code += `${name}${!!required ? '' : '?'}: string;`;

  return code;
}

interface IParameterMap {
  [name: string]: ParameterBaseObject;
}

interface IPathMapContent {
  summary: string | undefined;
  tags: string[];
  code: string;
}

interface IPathMap {
  [key: string]: IPathMapContent;
}

async function getCodeFromParameters(
  parameters: IParameterMap | undefined,
  name: string,
  exportKey: boolean = false,
): Promise<string> {
  if (!parameters) {
    return '';
  }

  const bodyCode = await Promise.all(
    Object.keys(parameters).map(parameterName => {
      return getCodeFromParameter(parameters[parameterName], parameterName);
    }),
  );
  return `${exportKey ? 'export' : ''} interface ${name} {\n${bodyCode.join('\n')}\n}`;
}

async function getCodeFromContent(
  content: ContentObject,
  typeNamePrefix: string,
  comment: string = '',
  responseTypeNames: string[] = [],
): Promise<string> {
  if (!content) {
    return '';
  }

  const contentCode = await Promise.all(
    Object.keys(content).map(async (mediaType, index) => {
      const responseTypeName = `${typeNamePrefix}${
        index > 0 ? getCamelcase(mediaType, { pascalCase: true }) : ''
      }`;
      let jsonSchema = transform((content[mediaType] as MediaTypeObject).schema as IJsonSchema);
      if (jsonSchema.includes('[]')) {
        jsonSchema = jsonSchema.replace(/\(|\)|(\[\])+/g, '');
        responseTypeNames.push(`${responseTypeName}[]`);
      } else {
        responseTypeNames.push(responseTypeName);
      }
      return `export type ${responseTypeName} = ${jsonSchema}`;
    }),
  );
  return contentCode.join('\n');
}

function getTagWithPaths(allTags: OpenAPIV3.TagObject[] | undefined, pathsMap: IPathMap) {
  const commonTag: OpenAPIV3.TagObject = {
    name: 'common',
    description: 'common tag',
  };
  const customTags = allTags ? allTags.concat([commonTag]) : [commonTag];
  const commonfilterPaths = Object.keys(pathsMap).filter(namespaceName => {
    let filter = true;
    customTags.forEach(currTag => {
      if (pathsMap[namespaceName].tags.includes(currTag.name)) {
        filter = false;
      }
    });
    return filter;
  });
  return customTags.map(currTag => {
    const pathsInCurrTag: { [key: string]: any } = {};
    let filterPaths = Object.keys(pathsMap).filter(namespaceName =>
      pathsMap[namespaceName].tags.includes(currTag.name),
    );
    if (currTag.name === 'common') {
      filterPaths = filterPaths.concat(commonfilterPaths);
    }
    filterPaths.map(namespaceName => {
      pathsInCurrTag[namespaceName] = pathsMap[namespaceName];
    });
    return {
      ...currTag,
      pathsInCurrTag,
    };
  });
}

export async function gen(options: {
  url?: string;
  path?: string;
  version: string;
  object?: OpenAPI.Document;
  // dir of output files
  outputDir: string;
  // fetch impl file path
  fetchModuleFile?: string;
  pascalCase?: boolean;
  handlePostScript?: (obj: OperationObject, method: string) => PostScriptReturnType;
}) {
  const {
    url,
    path: filePath,
    version,
    object,
    fetchModuleFile = `${__dirname}/defaultFetch.ts`,
    outputDir,
    pascalCase = true,
  } = options;

  let openApiData: OpenAPIV3.Document;
  if (url || filePath) {
    const { dereference, parse } = swaggerParser;
    let params: any = url || filePath;
    if (version === '2') {
      // convertUrl响应速度很慢，改为使用convertObj
      const { convertObj, convertFile } = swagger2openapi;
      const openapiConvert = url ? convertObj : convertFile;
      if (url) {
        try {
          const result = await Axios.get(url);
          if (result.status !== 200) {
            throw Error(`未返回正确的status code ${result.status}: ${url}`);
          }
          params = result.data;
        } catch (e) {
          console.error('e :>> ', e.message);
        }
      }
      const openapi = await openapiConvert(params, {
        patch: true,
      });
      openApiData = openapi.openapi || (await dereference(openapi.openapi));
    } else {
      openApiData = (await parse(params)) as OpenAPIV3.Document;
    }
  } else if (!object) {
    throw 'option: url or object must be specified one';
  } else {
    openApiData = object as OpenAPIV3.Document;
  }

  let baseUrl = '';
  if (openApiData.servers) {
    baseUrl = openApiData.servers[0].url;
  }

  const schemasTypesCode: string[] = [];
  const schemasClassCode: string[] = [];
  const { schemas } = openApiData.components || {};
  if (schemas) {
    Object.keys(schemas).forEach(schemaKey => {
      const schemaObject = schemas[schemaKey] as IJsonSchema;
      if (pascalCase) {
        schemaKey = camelcase(schemaKey, { pascalCase: true });
      }
      const transformObject = transform(schemaObject);
      schemasTypesCode.push(`export type ${schemaKey} = ${transformObject}`);
      const classObject = transformObject.replace(/[()]/g, '').replace(/components.schemas./g, '');
      schemasClassCode.push(`export class ${schemaKey} ${classObject}\n`);
    });
  }

  const { paths, tags: allTags } = openApiData;

  const pathsCode: string[] = [];
  const pathsMap: IPathMap = {};
  await Promise.all(
    Object.keys(paths).map(async urlPath => {
      const pathsObject: PathItemObject = paths[urlPath];
      const filterMethods = AllMethods.filter(method => !!(pathsObject as any)[method]);
      const pathsTypesCode: string[] = [];
      await Promise.all(
        filterMethods.map(async method => {
          const objectElement: OperationObject = (pathsObject as any)[method] as OperationObject;
          const {
            operationId,
            parameters = [],
            requestBody = {},
            responses,
            summary,
            tags,
          } = objectElement;

          let namespaceName =
            operationId ||
            `${method.toLowerCase()}${getCamelcase(urlPath, {
              pascalCase: true,
            })}`;
          namespaceName = camelcase(namespaceName.replace(/[^a-zA-Z0-9_]/g, ''), {
            pascalCase: true,
          });

          // request parameter
          const requestHeaders: IParameterMap = {};
          const requestCookies: IParameterMap = {};
          const requestQuery: IParameterMap = {};
          parameters.forEach(parameter => {
            const { in: keyIn, name, ...otherParams } = parameter as ParameterObject;
            switch (keyIn) {
              case 'query':
                requestQuery[name] = otherParams;
                break;
              case 'cookie':
                requestCookies[name] = otherParams;
                break;
              case 'header':
                if (['CONTENT-TYPE', 'COOKIE'].indexOf(name.toUpperCase()) === -1) {
                  requestHeaders[name] = otherParams;
                }
                break;
            }
          });
          const requestHeaderCode = await getCodeFromParameters(
            requestHeaders,
            'RequestHeader',
            true,
          );
          const requestQueryCode = await getCodeFromParameters(requestQuery, 'Query', true);
          const requestCookieCode = await getCodeFromParameters(requestCookies, 'Cookie', true);

          // request body
          const {
            content,
            required: requestBodyRequired,
            description: requestBodyDescription,
          } = requestBody as RequestBodyObject;

          const requestBodyTypeNames: string[] = [];
          const requestBodyCode = await getCodeFromContent(
            content,
            `Body`,
            requestBodyDescription,
            requestBodyTypeNames,
          );

          // response
          const responseTypeNames: string[] = [];
          const responsesArr = Object.keys(responses as Object);
          const responsesCode = (
            await Promise.all(
              responsesArr.map(async statusCode => {
                const responsesObjectElement: ResponseObject & ReferenceObject = (responses as any)[
                  statusCode
                ];
                const { $ref, content, description } = responsesObjectElement;

                if ($ref) {
                  // TODO
                  return [];
                } else {
                  // response
                  const typeNamePrefix = `Response${camelcase(statusCode, {
                    pascalCase: true,
                  })}`;
                  const responseCode = await getCodeFromContent(
                    content as ContentObject,
                    typeNamePrefix,
                    description,
                    responseTypeNames,
                  );

                  return responseCode;
                }
              }),
            )
          ).join('\n');

          const requestFuncTypeCode = `
            export const request = async (options: {
              query: Query;
              body${requestBodyRequired ? '' : '?'}: ${
            requestBodyTypeNames.length > 0 ? requestBodyTypeNames.join('|') : 'any'
          };
              headers?: RequestHeader;
              cookie?: Cookie;
            }, otherOptions?: any): Promise<{ body: ${
              responseTypeNames.length > 0 ? responseTypeNames.join('|') : 'any'
            } }> =>  {
              return fetchImpl({...options, ...otherOptions, url: '${baseUrl}${urlPath}', method: '${method.toLowerCase()}'});
            };
          `;

          const requestUrl = `export const url = \`${baseUrl}${urlPath}\``;

          let exportObj: { [key: string]: string } = {
            requestQueryCode,
            requestHeaderCode,
            requestCookieCode,
            requestBodyCode,
            responsesCode,
            requestFuncTypeCode,
            requestUrl,
          };

          if (options.handlePostScript) {
            const result = await options.handlePostScript(objectElement, method);

            exportObj = Object.assign({}, exportObj, result);
          }

          const exportArr: string[] = [];

          SortList.forEach(item => {
            exportArr.push(exportObj[item]);
          });

          Object.keys(exportObj).forEach(item => {
            if (!SortList.includes(item)) {
              exportArr.unshift(exportObj[item]);
            }
          });

          const pathsTypesArr = exportArr.map(exp => {
            return exp
              .replace(/export const request = async/, 'export type request =')
              .replace(/: Promise<([^>]+)>((\s|\S)+)/g, '=> Promise<$1>;');
          });
          pathsTypesCode.push(
            `export namespace ${namespaceName} {\n${pathsTypesArr.join('\n')}\n}`,
          );

          const generateClassArr = exportArr.map(exp => {
            return exp
              .replace(/ interface | type = /g, ' class ')
              .replace(/ type ([^=]+) = components.([a-zA-Z.]+)[;{}]?/g, ' class $1 extends $2 {}');
          });
          pathsMap[namespaceName] = {
            summary,
            tags: tags || [],
            code: generateClassArr.join('\n'),
          };
        }),
      );
      pathsCode.push(pathsTypesCode.join('\n'));
    }),
  );

  await deleteFolderRecursive(outputDir);

  // generate code
  await mkdirp(outputDir);

  const tagWithPaths = getTagWithPaths(allTags, pathsMap);

  await Promise.all(
    tagWithPaths.map(async currTag => {
      const currMap = currTag.pathsInCurrTag;
      if (Object.keys(currMap).length > 0) {
        const currTagNameDir = `${outputDir}/${currTag.name}`;
        await mkdirp(currTagNameDir);
        const tagIndex: string[] = [];
        Object.keys(currMap).map((namespaceName: string) => {
          const { summary, code } = currMap[namespaceName];
          const pathCode = [
            `/**
            * @namespace ${namespaceName}
            * @summary ${summary}
            */\n`,
            `import fetchImpl from '${path
              .relative(currTagNameDir, fetchModuleFile)
              .replace(/\.ts$/, '')}';`,
            schemasClassCode.length > 0 ? `import * as schemas from '../schemas';\n` : '\n',
            code,
          ].join('\n');
          tagIndex.push(`export * as ${namespaceName} from './${namespaceName}';`);
          fs.writeFileSync(`${currTagNameDir}/${namespaceName}.ts`, format(pathCode));
        });
        const tagCode = [
          `/**
          * @description ${currTag.description}
          */\n`,
          ...tagIndex,
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
