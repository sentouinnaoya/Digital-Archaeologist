import Parser, { type SyntaxNode } from 'tree-sitter';
import javascriptGrammar from 'tree-sitter-javascript';
import typescriptGrammar from 'tree-sitter-typescript';
import javaGrammar from 'tree-sitter-java';
import { languageForPath } from '../repositories/language-detector';

export type SourceParserKind = 'tree-sitter-javascript' | 'tree-sitter-typescript' | 'tree-sitter-tsx' | 'tree-sitter-java' | 'unsupported';
export type SourceFileStatus =
  | 'parsed'
  | 'syntax_error'
  | 'unsupported'
  | 'parse_failed';

export interface SourceSymbol {
  name: string;
  kind: string;
  startLine: number;
  endLine: number;
}

export interface SourceImport {
  source: string;
  kind: 'static' | 'commonjs' | 'dynamic' | 'java';
  names: string[];
  line: number;
}

export interface SourceModule {
  name: string;
  kind: 'relative' | 'package' | 'namespace';
  path: string | null;
}

export interface SourceSyntaxError {
  message: string;
  line: number;
  column: number;
}

export interface ParsedSourceFile {
  path: string;
  language: string | null;
  parser: SourceParserKind;
  status: SourceFileStatus;
  size: number;
  symbols: SourceSymbol[];
  imports: SourceImport[];
  modules: SourceModule[];
  syntaxErrors: SourceSyntaxError[];
  truncated: boolean;
}

const MAX_SYMBOLS = 500;
const MAX_IMPORTS = 250;
const MAX_ERRORS = 25;

const JS_SYMBOL_TYPES = new Set([
  'function_declaration',
  'generator_function_declaration',
  'class_declaration',
  'interface_declaration',
  'type_alias_declaration',
  'enum_declaration',
  'method_definition',
  'variable_declarator',
]);

const JAVA_SYMBOL_TYPES = new Set([
  'class_declaration',
  'interface_declaration',
  'enum_declaration',
  'record_declaration',
  'method_declaration',
  'constructor_declaration',
  'field_declaration',
]);

export function parseSourceFile(
  path: string,
  content: string,
  size: number,
  readError?: string,
): ParsedSourceFile {
  const language = languageForPath(path);
  const parserKind = parserKindForPath(path);
  if (readError) {
    return {
      path,
      language,
      parser: parserKind,
      status: 'parse_failed',
      size,
      symbols: [],
      imports: [],
      modules: [],
      syntaxErrors: [{ message: readError, line: 1, column: 0 }],
      truncated: false,
    };
  }
  const empty: ParsedSourceFile = {
    path,
    language,
    parser: parserKind,
    status: parserKind === 'unsupported' ? 'unsupported' : 'parsed',
    size,
    symbols: [],
    imports: [],
    modules: [],
    syntaxErrors:
      parserKind === 'unsupported'
        ? [
            {
              message: `No AST parser is available for ${language ?? 'this language'}; only file-level metadata was recorded.`,
              line: 1,
              column: 0,
            },
          ]
        : [],
    truncated: false,
  };

  if (parserKind === 'unsupported') return empty;

  try {
    const parser = new Parser();
    parser.setLanguage(grammarFor(parserKind));
    const tree = parser.parse(content);
    const root = tree.rootNode;
    const symbols = parserKind === 'tree-sitter-java'
      ? collectSymbols(root, JAVA_SYMBOL_TYPES)
      : collectSymbols(root, JS_SYMBOL_TYPES);
    const imports = parserKind === 'tree-sitter-java'
      ? collectJavaImports(root)
      : collectJavaScriptImports(root);
    const modules = collectModules(root, imports);
    const syntaxErrors = collectSyntaxErrors(root);
    const hasError = root.hasError || syntaxErrors.length > 0;

    return {
      ...empty,
      status: hasError ? 'syntax_error' : 'parsed',
      symbols: symbols.slice(0, MAX_SYMBOLS),
      imports: imports.slice(0, MAX_IMPORTS),
      modules,
      syntaxErrors: syntaxErrors.slice(0, MAX_ERRORS),
      truncated: symbols.length > MAX_SYMBOLS || imports.length > MAX_IMPORTS || syntaxErrors.length > MAX_ERRORS,
    };
  } catch (error) {
    return {
      ...empty,
      status: 'parse_failed',
      syntaxErrors: [
        {
          message: error instanceof Error ? error.message : 'Parser failed',
          line: 1,
          column: 0,
        },
      ],
    };
  }
}

function parserKindForPath(path: string): SourceParserKind {
  const extension = path.split('.').pop()?.toLowerCase() ?? '';
  if (extension === 'ts') return 'tree-sitter-typescript';
  if (extension === 'tsx') return 'tree-sitter-tsx';
  if (['js', 'jsx', 'mjs', 'cjs'].includes(extension)) return 'tree-sitter-javascript';
  if (extension === 'java') return 'tree-sitter-java';
  return 'unsupported';
}

function grammarFor(kind: SourceParserKind): unknown {
  switch (kind) {
    case 'tree-sitter-javascript':
      return javascriptGrammar;
    case 'tree-sitter-typescript':
      return typescriptGrammar.typescript;
    case 'tree-sitter-tsx':
      return typescriptGrammar.tsx;
    case 'tree-sitter-java':
      return javaGrammar;
    default:
      throw new Error(`No grammar for ${kind}`);
  }
}

function collectSymbols(root: SyntaxNode, types: Set<string>): SourceSymbol[] {
  const symbols: SourceSymbol[] = [];
  walk(root, (node) => {
    if (!node.isNamed || !types.has(node.type)) return;
    const name = symbolName(node);
    if (!name) return;
    symbols.push({
      name,
      kind: node.type,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
    });
  });
  return dedupeSymbols(symbols);
}

function symbolName(node: SyntaxNode): string | null {
  const named = node.childForFieldName('name') ?? findFirstNamed(node, [
    'identifier',
    'property_identifier',
    'type_identifier',
    'shorthand_property_identifier',
    'field_identifier',
    'object_pattern',
    'array_pattern',
  ]);
  return named ? stripQuotes(named.text).slice(0, 200) || null : null;
}

function collectJavaScriptImports(root: SyntaxNode): SourceImport[] {
  const imports: SourceImport[] = [];
  walk(root, (node) => {
    if (node.type === 'import_statement') {
      const sourceNode = node.childForFieldName('source') ?? findFirstNamed(node, ['string']);
      if (!sourceNode) return;
      const source = stripQuotes(sourceNode.text);
      const clause = node.childForFieldName('import_clause');
      imports.push({
        source,
        kind: 'static',
        names: clause ? clause.namedChildren.map((child) => stripQuotes(child.text).slice(0, 100)) : [],
        line: node.startPosition.row + 1,
      });
      return;
    }

    if (node.type === 'call_expression') {
      const callee = node.childForFieldName('function')?.text ?? '';
      if (callee !== 'require' && callee !== 'import') return;
      const argument = node.childForFieldName('arguments')?.namedChildren[0]
        ?? findFirstNamed(node, ['string']);
      if (!argument) return;
      imports.push({
        source: stripQuotes(argument.text),
        kind: callee === 'require' ? 'commonjs' : 'dynamic',
        names: [],
        line: node.startPosition.row + 1,
      });
    }
  });
  return imports;
}

function collectJavaImports(root: SyntaxNode): SourceImport[] {
  const imports: SourceImport[] = [];
  walk(root, (node) => {
    if (node.type !== 'import_declaration') return;
    const text = node.text
      .replace(/^import\s+/, '')
      .replace(/;\s*$/, '')
      .trim();
    if (!text) return;
    const isStatic = text.startsWith('static ');
    imports.push({
      source: text.replace(/^static\s+/, ''),
      kind: 'java',
      names: [],
      line: node.startPosition.row + 1,
    });
  });
  return imports;
}

function collectModules(root: SyntaxNode, imports: SourceImport[]): SourceModule[] {
  const modules: SourceModule[] = [];
  const seen = new Set<string>();
  for (const item of imports) {
    if (!item.source || seen.has(item.source)) continue;
    seen.add(item.source);
    modules.push({
      name: item.source,
      kind: item.source.startsWith('.') ? 'relative' : 'package',
      path: item.source.startsWith('.') ? item.source : null,
    });
  }
  walk(root, (node) => {
    if (node.type !== 'package_declaration') return;
    const name = node.text.replace(/^package\s+/, '').replace(/;\s*$/, '').trim();
    if (!name || seen.has(name)) return;
    seen.add(name);
    modules.push({ name, kind: 'namespace', path: null });
  });
  return modules;
}

function collectSyntaxErrors(root: SyntaxNode): SourceSyntaxError[] {
  const errors: SourceSyntaxError[] = [];
  walk(root, (node) => {
    if (!node.isError && !node.isMissing) return;
    errors.push({
      message: node.isMissing
        ? `Missing ${node.type}`
        : `Unexpected ${node.type}`,
      line: node.startPosition.row + 1,
      column: node.startPosition.column + 1,
    });
  });
  return errors;
}

function walk(node: SyntaxNode, visit: (node: SyntaxNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) walk(child, visit);
}

function findFirstNamed(node: SyntaxNode, types: string[]): SyntaxNode | null {
  for (const child of node.namedChildren) {
    if (types.includes(child.type)) return child;
  }
  return null;
}

function stripQuotes(value: string): string {
  return value.replace(/^['"`]/, '').replace(/['"`]$/, '');
}

function dedupeSymbols(symbols: SourceSymbol[]): SourceSymbol[] {
  const seen = new Set<string>();
  return symbols.filter((symbol) => {
    const key = `${symbol.kind}:${symbol.name}:${symbol.startLine}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
