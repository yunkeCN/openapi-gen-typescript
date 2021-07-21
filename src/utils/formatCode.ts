import { format as prettify, Options } from 'prettier';

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
