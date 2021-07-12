import { OpenAPIV3 } from 'openapi-types';

export const getBaseUrl = (openApiData: OpenAPIV3.Document) => {
  let baseUrl = '';
  if (openApiData.servers) {
    baseUrl = openApiData.servers[0].url;
  }
  return baseUrl;
};
