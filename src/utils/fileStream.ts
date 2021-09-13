// @ts-ignore
import * as mkdirp from 'mkdirp';
import * as fs from 'fs';
import * as path from 'path';
import { formatCode, getFileMap, toHump } from './format';
import { NotModifyCode } from '../constants';
import { IFileCode } from './type';

interface IProps {
  outputDir: string;
  fileCodeList: IFileCode[];
  fetchModuleFile: string;
  schemasClassCode: string[];
  schemasTypesCode: string[];
  pathsCode: string[];
}

export const writeFileFromIFileCode = async (props: IProps) => {
  const {
    outputDir,
    fileCodeList,
    fetchModuleFile,
    schemasClassCode,
    schemasTypesCode,
    pathsCode,
  } = props;
  await mkdirp(outputDir);
  const fileMap = getFileMap(fileCodeList);

  await Promise.all(
    Object.keys(fileMap).map(async dirName => {
      const fileList = fileMap[dirName];
      await mkdirp(`${outputDir}/${dirName}`);
      fileList.forEach(el => {
        const pathCode = [
          `/**
          * @namespace ${el.fileName}
          * @summary ${el.summary}
          */\n`,
          `import fetchImpl from '${path
            .relative(`${outputDir}/${dirName}`, fetchModuleFile)
            .replace(/\.ts$/, '')}';`
            .split(path.sep)
            .join('/'),
          schemasClassCode.length > 0 ? `import * as schemas from '../schemas';\n` : '\n',
          el.code,
        ].join('\n');
        fs.writeFileSync(`${outputDir}/${dirName}/${el.fileName}.ts`, formatCode(pathCode));
      });
      const tagCode = getTagCode(dirName, fileList);
      fs.writeFileSync(`${outputDir}/${dirName}/index.ts`, formatCode(tagCode));
    }),
  );

  const typesCode = getTypeCode({ schemasTypesCode, pathsCode });

  fs.writeFileSync(`${outputDir}/index.ts`, formatCode(typesCode));

  if (schemasClassCode.length > 0) {
    const schemasCode = [NotModifyCode, schemasClassCode.join('\n')].join('\n');
    fs.writeFileSync(`${outputDir}/schemas.ts`, formatCode(schemasCode));
  }
};

const getTagCode = (dirName: string, fileCodeList: IFileCode[]): string => {
  const nameSpaceList: string[] = fileCodeList
    .map(it => it.fileName as string)
    .map(it => toHump(it));
  const tagCode = [
    `/**
      * @description ${dirName.split('/').pop()}
      */\n`,
    ...nameSpaceList.map(key => `import * as ${key} from './${key}';`),
    `\nexport {
        ${nameSpaceList.join(',\n')}
      }`,
  ].join('\n');
  return tagCode;
};

const getTypeCode = (props: { schemasTypesCode: string[]; pathsCode: string[] }) => {
  const { schemasTypesCode, pathsCode } = props;
  const typesCode = [
    NotModifyCode,
    `export namespace components { export namespace schemas { ${schemasTypesCode.join('\n')} } } `,
    `export namespace Api { ${pathsCode.join('\n')} } `,
  ].join('\n');
  return typesCode;
};

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
