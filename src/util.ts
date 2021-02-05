import { format as prettify, Options } from 'prettier';
import * as fs from 'fs';
import * as path from 'path';

export const DEFAULT_OPTIONS: Options = {
  bracketSpacing: false,
  printWidth: 80,
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: 'none',
  useTabs: false,
};

export function format(code: string, options: Options = DEFAULT_OPTIONS): string {
  return prettify(code, { parser: 'typescript', ...options });
}

/**
 *
 * @param {*} filePath
 */
export function deleteFolderRecursive(filePath: string) {
  let files = [];
  /**
   * 判断给定的路径是否存在
   */
  if (fs.existsSync(filePath)) {
    /**
     * 返回文件和子目录的数组
     */
    files = fs.readdirSync(filePath);
    files.forEach(function (file, index) {
      const curPath = path.join(filePath, file);
      console.log(curPath);
      /**
       * fs.statSync同步读取文件夹文件，如果是文件夹，在重复触发函数
       */
      if (fs.statSync(curPath).isDirectory()) {
        // recurse
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    /**
     * 清除文件夹
     */
    fs.rmdirSync(filePath);
  } else {
    // console.log('给定的路径不存在，请给出正确的路径');
  }
}
