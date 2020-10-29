import {
  comment,
  nodeType,
  transformRef,
  tsArrayOf,
  tsIntersectionOf,
  tsPartial,
  tsUnionOf,
  tsTupleOf,
} from "./utils";
import { IJsonSchema, OpenAPIV3 } from "openapi-types";
import ReferenceObject = OpenAPIV3.ReferenceObject;

// type converter
export function transform(node: ReferenceObject | IJsonSchema, rootPath: string = ""): string {
  const nodeAsSchema: IJsonSchema = node as IJsonSchema;
  switch (nodeType(node)) {
    case "ref": {
      return transformRef((node as ReferenceObject).$ref as string, rootPath);
    }
    case "string":
    case "number":
    case "boolean": {
      return nodeType(node) || "any";
    }
    case "enum": {
      return tsUnionOf(
        (nodeAsSchema.enum as string[]).map((item) =>
          typeof item === "number" || typeof item === "boolean"
            ? item
            : `'${item}'`
        )
      );
    }
    case "oneOf": {
      return tsUnionOf((nodeAsSchema.oneOf as any[]).map(item => transform(item)));
    }
    case "anyOf": {
      return tsIntersectionOf(
        (nodeAsSchema.anyOf as any[]).map((anyOf) => tsPartial(transform(anyOf)))
      );
    }
    case "object": {
      // if empty object, then return generic map type
      if (
        (!nodeAsSchema.properties || !Object.keys(nodeAsSchema.properties).length) &&
        !nodeAsSchema.allOf &&
        !nodeAsSchema.additionalProperties
      ) {
        return `{ [key: string]: any }`;
      }

      let properties = createKeys(nodeAsSchema.properties || {}, nodeAsSchema.required as string[]);

      // if additional properties, add to end of properties
      if (nodeAsSchema.additionalProperties) {
        properties += `[key: string]: ${
          nodeAsSchema.additionalProperties === true
            ? "any"
            : transform(nodeAsSchema.additionalProperties as IJsonSchema) || "any"
        };\n`;
      }

      return tsIntersectionOf([
        ...(nodeAsSchema.allOf ? (nodeAsSchema.allOf as any[]).map(item => transform(item)) : []), // append allOf first
        ...(properties ? [`{ ${properties} }`] : []), // then properties + additionalProperties
      ]);
    }
    case "array": {
      if (Array.isArray(nodeAsSchema.items)) {
        return tsTupleOf(nodeAsSchema.items.map(item => transform(item)));
      } else {
        return tsArrayOf(nodeAsSchema.items ? transform(nodeAsSchema.items as any) : "any");
      }
    }
  }

  return "";
}

function createKeys(
  obj: { [key: string]: any },
  required?: string[]
): string {
  let output = "";

  Object.entries(obj).forEach(([key, value]) => {
    // 1. JSDoc comment (goes above property)
    if (typeof value.description === "string") {
      output += comment(value.description);
    }

    // 2. name (with “?” if optional property)
    output += `"${key}"${!required || !required.includes(key) ? "?" : ""}: `;

    // 3. open nullable
    if (value.nullable) {
      output += "(";
    }

    // 4. transform
    output += transform(value.schema ? value.schema : value);

    // 5. close nullable
    if (value.nullable) {
      output += ") | null";
    }

    // 6. close type
    output += ";\n";
  });

  return output;
}
