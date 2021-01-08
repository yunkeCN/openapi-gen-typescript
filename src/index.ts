// @ts-ignore
import * as swagger2openapi from 'swagger2openapi';
import * as swaggerParser from '@apidevtools/swagger-parser';
// @ts-ignore
import * as mkdirp from 'mkdirp';
import * as camelcase from 'camelcase';
import { Options } from "camelcase";
import * as fs from 'fs';
import * as path from "path";
import { transform } from "./schemaToTypes/transform";
import { format } from "./util";
import { IJsonSchema, OpenAPI, OpenAPIV3 } from "openapi-types";
import ParameterBaseObject = OpenAPIV3.ParameterBaseObject;
import MediaTypeObject = OpenAPIV3.MediaTypeObject;
import OperationObject = OpenAPIV3.OperationObject;
import PathItemObject = OpenAPIV3.PathItemObject;
import ResponseObject = OpenAPIV3.ResponseObject;
import ReferenceObject = OpenAPIV3.ReferenceObject;
import ParameterObject = OpenAPIV3.ParameterObject;
import RequestBodyObject = OpenAPIV3.RequestBodyObject;

type ContentObject = {
  [media: string]: MediaTypeObject;
}

enum ETemplateCode {
  RequestQueryCode = 'requestQueryCode',
  RequestHeaderCode = 'requestHeaderCode',
  RequestCookieCode = 'requestCookieCode',
  RequestBodyCode = 'requestBodyCode',
  ResponsesCode = 'responsesCode',
  RequestFuncTypeCode = 'requestFuncTypeCode',
}

type PostScriptReturnType = {
  [key in ETemplateCode]: string;
} | {
  [key: string]: string;
}

function getCamelcase(urlPath: string, options?: Options): string {
  return camelcase(urlPath.split('/').join('_'), options);
}

function getCodeFromParameter(parameter: ParameterBaseObject, name: string): string {
  const { description, required } = parameter;

  let code = '';

  if (description) {
    code += `/* ${description} */\n`
  }

  code += `${name}${!!required ? '' : '?'}: string;`;

  return code;
}

interface ParameterMap {
  [name: string]: ParameterBaseObject;
}

async function getCodeFromParameters(
  parameters: ParameterMap | undefined,
  name: string,
  exportKey: boolean = false,
): Promise<string> {
  if (!parameters) {
    return '';
  }

  const bodyCode = (await Promise.all(Object.keys(parameters).map((parameterName) => {
    return getCodeFromParameter(parameters[parameterName], parameterName);
  }))).join('\n');
  return `${exportKey ? 'export' : ''} interface ${name} {\n${bodyCode}\n}`;
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

  return (await Promise.all(Object.keys(content).map(async (mediaType, index) => {
    const responseTypeName = `${typeNamePrefix}${index > 0 ? getCamelcase(mediaType, { pascalCase: true }) : ''}`;
    responseTypeNames.push(responseTypeName);
    return `export type ${responseTypeName} = ${transform((content[mediaType] as MediaTypeObject).schema as IJsonSchema)}`
  }))).join('\n');
}

export async function gen(options: {
  url?: string;
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
    version,
    object,
    fetchModuleFile = `${__dirname}/defaultFetch.ts`,
    outputDir,
    pascalCase = true,
  } = options;

  const fetchModuleImportCode = `import fetchImpl from '${path.relative(outputDir, fetchModuleFile).replace(/\.ts$/, '')}';\n`;

  let openApiData: OpenAPIV3.Document;
  if (url) {
    if (version === '2') {
      const openapi = await swagger2openapi.convertUrl(url, {
        patch: true,
      });
      openApiData = openapi.openapi || await swaggerParser.dereference(openapi.openapi);
    } else {
      openApiData = await swaggerParser.parse(url) as OpenAPIV3.Document;
    }
  } else if (!object) {
    throw 'option: url or object must be specified one'
  } else {
    openApiData = object as OpenAPIV3.Document;
  }

  let baseUrl = '';
  if (openApiData.servers) {
    baseUrl = openApiData.servers[0].url;
  }

  let schemasCode: string = '';
  const { schemas } = openApiData.components || {};
  if (schemas) {
    schemasCode = (await Promise.all(Object.keys(schemas).map(async (schemaKey) => {
      const schemaObject = schemas[schemaKey] as IJsonSchema;
      if (pascalCase) {
        schemaKey = camelcase(schemaKey, { pascalCase: true });
      }
      return `export type ${schemaKey} = ${transform(schemaObject)}`;
    }))).join('\n');
  }

  const { paths } = openApiData;
  const methods = ['get', 'post', 'options', 'put', 'delete', 'patch', 'head'];
  const pathsCode = (await Promise.all(Object.keys(paths)
    .map(async (urlPath) => {
      const pathsObject: PathItemObject = paths[urlPath];
      return (await Promise.all(methods.filter(method => !!(pathsObject as any)[method])
        .map(async (method) => {
          const objectElement: OperationObject = (pathsObject as any)[method] as OperationObject;
          const {
            operationId,
            parameters = [],
            requestBody = {},
            responses,
          } = objectElement;

          let namespaceName = camelcase(operationId || `${method.toLowerCase()}${getCamelcase(urlPath, { pascalCase: true })}`, { pascalCase: true });
          namespaceName = namespaceName.replace(/[^a-zA-Z0-9_]/g, "");
          const responseTypeNames: string[] = [];
          const responsesCode: string = (await Promise.all(Object.keys(responses as Object)
            .filter(key => key !== 'default')
            .map(async (statusCode) => {
              const responsesObjectElement: ResponseObject & ReferenceObject = (responses as any)[statusCode];
              const { $ref, content, description } = responsesObjectElement;

              if ($ref) {
                // TODO
                return '';
              } else {
                // response
                const typeNamePrefix = `Response${camelcase(statusCode, { pascalCase: true })}`;
                const responseCode = await getCodeFromContent(
                  content as ContentObject,
                  typeNamePrefix,
                  description,
                  responseTypeNames,
                );

                return responseCode;
              }
            }))).join('\n');

          // request parameter
          const requestHeaders: ParameterMap = {};
          const requestCookies: ParameterMap = {};
          const requestQuery: ParameterMap = {};
          parameters.forEach((parameter) => {
            const { in: keyIn, name, ...otherParams } = parameter as ParameterObject;
            switch (keyIn) {
              case 'query':
                requestQuery[name] = otherParams;
                break;
              case 'cookie':
                requestCookies[name] = otherParams;
                break;
              case 'header':
                if (["CONTENT-TYPE", "COOKIE"].indexOf(name.toUpperCase()) === -1) {
                  requestHeaders[name] = otherParams;
                }
                break;
            }
          });
          const requestHeaderCode = await getCodeFromParameters(requestHeaders, 'RequestHeader', true);
          const requestQueryCode = await getCodeFromParameters(requestQuery, 'Query', true);
          const requestCookieCode = await getCodeFromParameters(requestCookies, 'Cookie', true);

          const { content, required: requestBodyRequired, description: requestBodyDescription } = (requestBody as RequestBodyObject);

          const requestBodyTypeNames: string[] = [];
          const requestBodyCode = await getCodeFromContent(content, `Body`, requestBodyDescription, requestBodyTypeNames);

          const requestFuncTypeCode = `
export async function request(options: {
  query: Query;
  body${requestBodyRequired ? '' : '?'}: ${requestBodyTypeNames.length > 0 ? requestBodyTypeNames.join('|') : 'any'};
  headers?: RequestHeader;
  cookie?: Cookie;
}, otherOptions?: any): Promise<{ body: ${responseTypeNames.length > 0 ? responseTypeNames.join('|') : 'any'} }> {
  return fetchImpl({...options, ...otherOptions, url: '${baseUrl}${urlPath}', method: '${method.toLowerCase()}'});
}
`;


          let exportObj: { [key: string]: string } = {
            requestQueryCode,
            requestHeaderCode,
            requestCookieCode,
            requestBodyCode,
            responsesCode,
            requestFuncTypeCode,
          }

          if (options.handlePostScript) {
            const result = await options.handlePostScript(objectElement, method);

            exportObj = Object.assign({}, exportObj, result);
          }

          const sortList = ['requestQueryCode', 'requestHeaderCode', 'requestCookieCode', 'requestBodyCode', 'responsesCode', 'requestFuncTypeCode'];

          const exportArr: string[] = [];

          sortList.forEach(item => {
            exportArr.push(exportObj[item]);
          })

          Object.keys(exportObj).forEach(item => {
            if (!sortList.includes(item)) {
              exportArr.unshift(exportObj[item]);
            }
          })

          return `export namespace ${namespaceName} {\n${exportArr.join('\n')
            } \n}`;
        })))
        .join('\n');
    })))
    .join('\n');
  const code = format([
    `/* tslint:disable */
/**
* This file was automatically generated by openapi-gen-typescript.
* DO NOT MODIFY IT BY HAND.
*/`,
    fetchModuleImportCode,
    `export namespace components { export namespace schemas { ${schemasCode} } } `,
    `export namespace Api { ${pathsCode} } `,
  ].join('\n'));

  await mkdirp(outputDir);
  fs.writeFileSync(`${outputDir}/index.ts`, code);

  console.info(`Generate code successful in directory: ${outputDir}`);
}
