import * as swagger2openapi from 'swagger2openapi';
import * as swaggerParser from '@apidevtools/swagger-parser';
import * as mkdirp from 'mkdirp';
import { compile, DEFAULT_OPTIONS } from 'json-schema-to-typescript'
import { format } from 'json-schema-to-typescript/dist/src/formatter'
import {
  BaseParameterObject, ContentObject,
  MediaTypeObject,
  OpenAPIObject,
  OperationObject,
  ParameterObject, RequestBodyObject
} from 'openapi3-ts';
import * as camelcase from 'camelcase';
import { Options } from "camelcase";
import * as fs from 'fs';
import * as path from "path";

function getCamelcase(urlPath: string, options?: Options): string {
  return camelcase(urlPath.split('/').join('_'), options);
}

function getCodeFromParameter(parameter: BaseParameterObject, name: string): string {
  const { description, required } = parameter;

  let code = '';

  if (description) {
    code += `/* ${description} */\n`
  }

  code += `${name}${!!required ? '' : '?'}: string;`;

  return code;
}

interface ParameterMap {
  [name: string]: BaseParameterObject;
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
    return await compile(
      {
        ...(content[mediaType] as MediaTypeObject).schema,
        title: responseTypeName,
      },
      responseTypeName,
      {
        bannerComment: comment,
        $refOptions: { resolve: { file: null, external: true } as any },
      },
    );
  }))).join('\n');
}

export async function gen(options: {
  url?: string;
  version: string;
  object?: OpenAPIObject;
  // dir of output files
  outputDir: string;
  // fetch impl file path
  fetchModuleFile?: string;
}) {
  const {
    url,
    version,
    object,
    fetchModuleFile = `${__dirname}/defaultFetch.ts`,
    outputDir,
  } = options;

  const fetchModuleImportCode = `import fetchImpl from '${path.relative(outputDir, fetchModuleFile).replace(/\.ts$/, '')}';`

  let openApiData: OpenAPIObject;
  if (url){
    if (version === '2') {
      const openapi = await swagger2openapi.convertUrl(url, {
        patch: true,
      });
      openApiData = await swaggerParser.dereference(openapi.openapi);
    } else {
      openApiData = await swaggerParser.parse(url);
    }
  } else if (!object) {
    throw 'option: url or object must be specified one'
  } else {
    openApiData = object;
  }

  const { schemas } = openApiData.components;
  const schemasCode = (await Promise.all(Object.keys(schemas).map(async (schemaKey) => {
    return await compile({ ...schemas[schemaKey], title: schemaKey }, schemaKey, {
      bannerComment: '',
      unreachableDefinitions: true,
    });
  }))).join('\n');

  const { paths } = openApiData;
  const methods = ['get', 'post', 'options', 'put', 'delete', 'patch', 'head'];
  const pathsCode = (await Promise.all(Object.keys(paths)
    .map(async (urlPath) => {
      const pathsObject = paths[urlPath];
      return (await Promise.all(methods.filter(method => !!pathsObject[method])
        .map(async (method) => {
          const objectElement: OperationObject = pathsObject[method];
          const {
            operationId,
            description,
            parameters = [],
            requestBody = {},
            summary,
            responses,
          } = objectElement;

          const namespaceName = camelcase(operationId || `${method.toLowerCase()}${getCamelcase(urlPath, { pascalCase: true })}`, { pascalCase: true });
          const responseTypeNames: string[] = [];
          const responsesCode: string = (await Promise.all(Object.keys(responses)
            .map(async (statusCode) => {
              const responsesObjectElement = responses[statusCode];
              const { $ref, content, description, headers } = responsesObjectElement;

              if ($ref) {
                // TODO
                return '';
              } else {
                // response
                const typeNamePrefix = `Response${camelcase(statusCode, { pascalCase: true })}`;
                const responseCode = await getCodeFromContent(content, typeNamePrefix, description, responseTypeNames);

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
  header?: RequestHeader;
  cookie?: Cookie;
}): Promise<{ body: ${responseTypeNames.length > 0 ? responseTypeNames.join('|') : 'any'} }> {
  return fetchImpl({...options, url: '${urlPath}'});
}
`;

          return `export namespace ${namespaceName} {\n${[
            requestQueryCode,
            requestHeaderCode,
            requestCookieCode,
            requestBodyCode,
            responsesCode,
            requestFuncTypeCode,
          ].join('\n')}\n}`;
        })))
        .join('\n');
    })))
    .join('\n');
  const code = format([
    `/* tslint:disable */
/**
* This file was automatically generated by openapi-ts.
* DO NOT MODIFY IT BY HAND.
*/`,
    fetchModuleImportCode,
    `export namespace Schema {${schemasCode}}`,
    `export namespace Api { ${pathsCode} }`,
  ].join('\n'), DEFAULT_OPTIONS);

  await mkdirp(outputDir);
  fs.writeFileSync(`${outputDir}/index.ts`, code);
  process.exit(0);
}
