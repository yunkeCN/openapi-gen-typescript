import * as camelcase from 'camelcase';
import { Options as IOptions } from 'camelcase';
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

// 格式化代码
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

export const toHump = (name: string) => {
  return name.replace(/\-(\w)/g, function (all, letter) {
    return letter.toUpperCase();
  });
};

export function getCamelcase(urlPath: string, options?: IOptions): string {
  return camelcase(urlPath.split('/').join('_'), options);
}

export const pathSplicing = (baseUrl: string, urlPath: string): string => {
  let result = '';
  if (baseUrl[baseUrl.length - 1] === '/' && urlPath[0] === '/') {
    result = `${baseUrl.slice(0, -1)}${urlPath}`;
  } else {
    result = `${baseUrl}${urlPath}`;
  }
  return result;
};
