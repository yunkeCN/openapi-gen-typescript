import { IFileCode } from './getCodeFromPaths';

export type IFileMap = {
  [key: string]: IFileCode[];
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
