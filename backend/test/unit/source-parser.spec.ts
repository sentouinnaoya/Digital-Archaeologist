import { parseSourceFile } from '../../src/modules/code-analysis/source-parser';

describe('parseSourceFile', () => {
  it('extracts TypeScript symbols, imports and modules', () => {
    const code = `import { Helper } from './helper';
export class Widget {
  render(): string { return 'ok'; }
}
`;
    const result = parseSourceFile('src/Widget.ts', code, Buffer.byteLength(code));

    expect(result.language).toBe('TypeScript');
    expect(result.parser).toBe('tree-sitter-typescript');
    expect({ status: result.status, syntaxErrors: result.syntaxErrors }).toMatchObject({
      status: 'parsed',
    });
    expect(result.symbols.map((symbol) => symbol.name)).toEqual(
      expect.arrayContaining(['Widget', 'render']),
    );
    expect(result.imports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: './helper', kind: 'static' }),
      ]),
    );
    expect(result.modules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: './helper', kind: 'relative' }),
      ]),
    );
  });

  it('extracts Java packages, imports, types and methods', () => {
    const code = `package com.example.demo;
import java.util.List;
public class Service {
  public void run() {}
}
`;
    const result = parseSourceFile('src/Service.java', code, Buffer.byteLength(code));

    expect(result.language).toBe('Java');
    expect(result.parser).toBe('tree-sitter-java');
    expect({ status: result.status, syntaxErrors: result.syntaxErrors }).toMatchObject({
      status: 'parsed',
    });
    expect(result.symbols.map((symbol) => symbol.name)).toEqual(
      expect.arrayContaining(['Service', 'run']),
    );
    expect(result.imports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'java.util.List', kind: 'java' }),
      ]),
    );
    expect(result.modules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'com.example.demo', kind: 'namespace' }),
      ]),
    );
  });

  it('labels unsupported languages instead of pretending to parse them', () => {
    const result = parseSourceFile('src/script.py', 'print("hello")', 14);

    expect(result.parser).toBe('unsupported');
    expect(result.status).toBe('unsupported');
    expect(result.symbols).toEqual([]);
    expect(result.syntaxErrors[0].message).toContain('No AST parser');
  });

  it('marks unreadable files as failed instead of pretending they were empty', () => {
    const result = parseSourceFile(
      'src/generated.ts',
      '',
      0,
      'Source file could not be read at this commit',
    );

    expect(result.status).toBe('parse_failed');
    expect(result.symbols).toEqual([]);
    expect(result.syntaxErrors[0]).toMatchObject({
      message: 'Source file could not be read at this commit',
    });
  });

  it('tolerates syntax errors and still records recovered structure', () => {
    const code = 'function broken( { return 1; ';
    const result = parseSourceFile('src/broken.js', code, Buffer.byteLength(code));

    expect(result.parser).toBe('tree-sitter-javascript');
    expect({ status: result.status, syntaxErrors: result.syntaxErrors }).toMatchObject({
      status: 'syntax_error',
    });
    expect(result.syntaxErrors.length).toBeGreaterThan(0);
  });
});
