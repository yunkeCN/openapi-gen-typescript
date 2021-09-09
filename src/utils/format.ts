import { OpenAPIV3 } from 'openapi-types';
import { format as prettify, Options } from 'prettier';
import { IFileCode, IFileMap } from './type';

const DEFAULT_OPTIONS: Options = {
  bracketSpacing: false,
  printWidth: 80,
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: 'none',
  quoteProps: 'preserve',
  useTabs: false,
};

export function formatCode(code: string, options: Options = DEFAULT_OPTIONS): string {
  return prettify(code, { parser: 'typescript', ...options });
}

export const getBaseUrl = (openApiData: OpenAPIV3.Document) => {
  let baseUrl = '';
  if (openApiData.servers) {
    baseUrl = openApiData.servers[0].url;
  }
  return baseUrl;
};

// 将含有代码和路径的对象数组转换为map
export const getFileMap = (list: IFileCode[]) => {
  const map: IFileMap = {};
  list.forEach(el => {
    const key = el.dirName as string;
    if (map[key]) {
      map[key].push(el);
    } else {
      map[key] = [el];
    }
  });
  return map;
};
