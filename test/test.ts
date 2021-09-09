import { gen } from '../src';
// import * as path from 'path';

(async function () {
  await gen({
    url: 'https://petstore.swagger.io/v2/swagger.json',
    // path: path.join(__dirname, './petstore.json'),
    // object: {
    //   swagger: '2.0',
    //   info: {
    //     description: '',
    //     title: 'bff-example',
    //     version: '',
    //   },
    //   basePath: '',
    //   tags: [
    //     {
    //       name: 'auth',
    //       description: 'auth',
    //     },
    //   ],
    //   paths: {
    //     '/user/auth': {
    //       post: {
    //         operationId: 'postuserauth',
    //         tags: ['auth'],
    //         summary: 'auth search',
    //         description: '# 1',
    //         consumes: ['application/json'],
    //         produces: ['application/json'],
    //         parameters: [
    //           {
    //             in: 'body',
    //             name: 'body',
    //             required: true,
    //             schema: {
    //               type: 'object',
    //               title: 'empty object',
    //               properties: {
    //                 user_id: {
    //                   type: 'string',
    //                 },
    //               },
    //             },
    //           },
    //           {
    //             name: 'Content-Type',
    //             description: '',
    //             in: 'header',
    //             type: 'string',
    //             default: 'application/json',
    //             required: false,
    //           },
    //           {
    //             name: 'cookie',
    //             description: '',
    //             in: 'header',
    //             type: 'string',
    //             default: '',
    //             required: true,
    //           },
    //         ],
    //         responses: {
    //           '200': {
    //             description: '',
    //             schema: {
    //               type: 'object',
    //               title: 'empty object',
    //               properties: {
    //                 code: {
    //                   type: 'number',
    //                 },
    //                 data: {
    //                   type: 'object',
    //                   properties: {
    //                     id: {
    //                       type: 'number',
    //                     },
    //                     user_id: {
    //                       type: 'number',
    //                     },
    //                     insert: {
    //                       type: 'string',
    //                     },
    //                     delete: {
    //                       $ref: '#/definitions/ref1',
    //                     },
    //                     update: {
    //                       type: 'string',
    //                     },
    //                     select: {
    //                       type: 'string',
    //                     },
    //                     create_time: {
    //                       type: 'string',
    //                     },
    //                   },
    //                 },
    //               },
    //             },
    //           },
    //         },
    //       },
    //     },
    //   },
    //   definitions: {
    //     ref1: {
    //       type: 'object',
    //       title: 'empty object',
    //       properties: {
    //         field_1: {
    //           type: 'string',
    //         },
    //       },
    //     },
    //   },
    // },
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
