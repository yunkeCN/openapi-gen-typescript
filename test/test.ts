import { gen } from '../src';
// import * as path from "path";

(async function () {
  await gen({
    url: 'https://petstore.swagger.io/v2/swagger.json',
    // url:
    // 'https://api.myscrm.cn/api/interface/swagger/6109/master?token=997b2bee28286319ca91&status=all',
    // path: path.join(__dirname, "./petstore.json"),
    version: '2',
    outputDir: `${__dirname}/gen`,
    handlePostScript: obj => {
      const { parameters = [] } = obj;
      const requestQuery: string[] = [];
      const requestPath: string[] = [];
      parameters.forEach(parameter => {
        const { in: keyIn, name } = parameter as any;
        switch (keyIn) {
          case 'query':
            requestQuery.push(`"${name}"`);
            break;
          case 'path':
            requestPath.push(`"${name}"`);
            break;
        }
      });
      const requestPathVariable =
        requestPath.length > 0 ? `export const requestPath = [${requestPath.join(', ')}]` : '';
      const requestQueryVariable =
        requestQuery.length > 0 ? `export const requestQuery = [${requestQuery.join(', ')}]` : '';
      return {
        requestPathVariable,
        requestQueryVariable,
      };
    },
  });
  process.exit(0);
})();
