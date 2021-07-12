import { mkdirp } from 'fs-extra';
import * as fs from 'fs';
import { OpenAPIV3 } from 'openapi-types';
import * as path from 'path';
import { format } from './format';
import { NotModifyCode } from '../constants';

interface ITagsProps {
  tagWithPaths: {
    pathsInCurrTag: {
      [key: string]: any;
    };
    name: string;
    description?: string | undefined;
    externalDocs?: OpenAPIV3.ExternalDocumentationObject | undefined;
  }[];
  outputDir: string;
  fetchModuleFile: string;
  schemasClassCode: string[];
}

interface IDirProps {
  pathsCode: string[];
  outputDir: string;
  schemasClassCode: string[];
  schemasTypesCode: string[];
}

export const genFileFromTag = async (props: ITagsProps) => {
  const { tagWithPaths, outputDir, fetchModuleFile, schemasClassCode } = props;
  await Promise.all(
    tagWithPaths.map(async currTag => {
      const currMap = currTag.pathsInCurrTag;
      if (Object.keys(currMap).length > 0) {
        const currTagNameDir = `${outputDir}/${currTag.name}`;
        await mkdirp(currTagNameDir);
        const namespaceNameArr: string[] = [];
        Object.keys(currMap).map((namespaceName: string) => {
          const { summary, code } = currMap[namespaceName];
          const pathCode = [
            `/**
                * @namespace ${namespaceName}
                * @summary ${summary}
                */\n`,
            `import fetchImpl from '${path
              .relative(currTagNameDir, fetchModuleFile)
              .replace(/\.ts$/, '')}';`
              .split(path.sep)
              .join('/'),
            schemasClassCode.length > 0 ? `import * as schemas from '../schemas';\n` : '\n',
            code,
          ].join('\n');
          namespaceNameArr.push(namespaceName);
          fs.writeFileSync(`${currTagNameDir}/${namespaceName}.ts`, format(pathCode));
        });
        const tagCode = [
          `/**
              * @description ${currTag.description}
              */\n`,
          ...namespaceNameArr.map(key => `import * as ${key} from './${key}';`),
          `\nexport {
                ${namespaceNameArr.join(',\n')}
              }`,
        ].join('\n');

        fs.writeFileSync(`${currTagNameDir}/index.ts`, format(tagCode));
      }
    }),
  );
};

export const genIndexForDir = async (props: IDirProps) => {
  const { pathsCode, outputDir, schemasClassCode, schemasTypesCode } = props;
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
};
