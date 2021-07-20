import { OpenAPIV3 } from 'openapi-types';
import { getCodeFromContent, getCodeFromParameters, getContentFromComponents } from './genCode';
import { IParameterMap } from './type';
import ParameterObject = OpenAPIV3.ParameterObject;
import ReferenceObject = OpenAPIV3.ReferenceObject;
import RequestBodyObject = OpenAPIV3.RequestBodyObject;

interface IGetReqParams {
  parameters: (OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject)[];
}

interface IGetReqBody {
  requestBody: any;
  openApiData: OpenAPIV3.Document<{}>;
}

export const getReqParams = async (props: IGetReqParams) => {
  // request parameter
  const { parameters } = props;

  const requestPath: IParameterMap = {};
  const requestHeaders: IParameterMap = {};
  const requestCookies: IParameterMap = {};
  const requestQuery: IParameterMap = {};
  parameters.forEach(parameter => {
    const { in: keyIn, name, ...otherParams } = parameter as ParameterObject;
    switch (keyIn) {
      case 'path':
        requestPath[name] = otherParams;
        break;
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
  const requestPathCode = await getCodeFromParameters(requestPath, 'Path', true);
  const requestQueryCode = await getCodeFromParameters(requestQuery, 'Query', true);
  const requestCookieCode = await getCodeFromParameters(requestCookies, 'Cookie', true);
  const requestHeaderCode = await getCodeFromParameters(requestHeaders, 'RequestHeader', true);
  return {
    requestPathCode,
    requestQueryCode,
    requestCookieCode,
    requestHeaderCode,
    requestPath,
  };
};

export const getReqBody = async (props: IGetReqBody) => {
  const { requestBody, openApiData } = props;

  const {
    $ref: requestRef,
    content,
    description: requestBodyDescription,
  }: ReferenceObject & RequestBodyObject = requestBody as any;

  let requestBodyCode = '';
  const requestBodyTypeNames: string[] = [];

  if (requestRef) {
    requestBodyCode = await getContentFromComponents(
      openApiData,
      requestRef,
      `Body`,
      requestBodyTypeNames,
    );
  } else {
    requestBodyCode = await getCodeFromContent(
      content,
      `Body`,
      requestBodyDescription,
      requestBodyTypeNames,
    );
  }
  return { requestBodyCode, requestBodyTypeNames };
};
