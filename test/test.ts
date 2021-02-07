import { gen } from '../src';
// import * as path from "path";

(async function () {
  await gen({
    url: 'https://petstore.swagger.io/v2/swagger.json',
    // path: path.join(__dirname, "./petstore.json"),
    version: '2',
    outputDir: `${__dirname}/gen`,
    handlePostScript: (obj, method) => {
      const { parameters = [] } = obj;
      const requestVariable: string[] = [];
      parameters.forEach(parameter => {
        const { in: keyIn, name } = parameter as any;
        switch (keyIn) {
          case 'query':
            if (method.toLowerCase() === 'get') {
              requestVariable.push(`"${name}"`);
            }
            break;
        }
      });
      const requestVariableCode =
        requestVariable.length > 0
          ? `export const requestVariable = [${requestVariable.join(', ')}]`
          : '';
      return {
        requestVariableCode,
      };
    },
  });
  process.exit(0);
})();
