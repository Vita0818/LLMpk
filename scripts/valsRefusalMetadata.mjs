import { parse } from '@babel/parser';

/** Resolve literal data declarations only. Upstream JavaScript is never executed. */
export function extractValsRefusalDatasets(source) {
  const ast = parse(source, { sourceType: 'module' });
  const bindings = new Map();
  const datasets = new Map();
  function literal(node) {
    if (!node) throw new Error('Missing literal.');
    if (['StringLiteral', 'NumericLiteral', 'BooleanLiteral'].includes(node.type)) return node.value;
    if (node.type === 'NullLiteral') return null;
    if (node.type === 'Identifier' && bindings.has(node.name)) return bindings.get(node.name);
    if (node.type === 'UnaryExpression' && ['-', '+'].includes(node.operator)) {
      const value = literal(node.argument);
      if (typeof value !== 'number') throw new Error('Non-numeric unary literal.');
      return node.operator === '-' ? -value : value;
    }
    if (node.type === 'ArrayExpression') return node.elements.map(literal);
    if (node.type === 'ObjectExpression') {
      const value = Object.create(null);
      for (const property of node.properties) {
        if (property.type !== 'ObjectProperty' || property.computed || property.method) throw new Error('Non-literal property.');
        const key = property.key.type === 'Identifier' ? property.key.name : property.key.value;
        if (typeof key !== 'string' || Object.hasOwn(value, key)) throw new Error('Invalid literal key.');
        Object.defineProperty(value, key, { value: literal(property.value), enumerable: true, writable: true });
      }
      return value;
    }
    throw new Error('Executable initializer is not a data literal.');
  }
  for (const statement of ast.program.body) {
    if (statement.type !== 'VariableDeclaration') continue;
    for (const declaration of statement.declarations) {
      if (declaration.id.type !== 'Identifier') continue;
      let value;
      try { value = literal(declaration.init); } catch { continue; }
      bindings.set(declaration.id.name, value);
      if (value?.schemaVersion === 1 && typeof value.benchmark === 'string'
        && value.models && typeof value.models === 'object' && !Array.isArray(value.models)) {
        if (datasets.has(value.benchmark)) throw new Error('Duplicate Vals refusal dataset.');
        datasets.set(value.benchmark, value);
      }
    }
  }
  if (datasets.size < 1) throw new Error('Vals refusal metadata data declarations changed.');
  return datasets;
}

export function extractValsRefusalModulePath(loaderSource) {
  const paths = [...new Set([...loaderSource.matchAll(/["'](\.\/WipeSwap\.[\w-]+\.js)["']/gu)].map(match => match[1]))];
  if (paths.length !== 1) throw new Error('Vals refusal metadata module reference changed.');
  return paths[0];
}

export function validateValsRefusalRecord(record, publishedScore, context) {
  if (record === null || record?.status === 'unavailable') return;
  if (record?.status !== 'available') throw new Error(`Unknown Vals refusal status: ${context}.`);
  for (const key of ['publishedScorePct', 'noFallbackScorePct']) {
    if (typeof record[key] !== 'number' || !Number.isFinite(record[key]) || record[key] < 0 || record[key] > 100) {
      throw new Error(`Invalid Vals refusal score: ${context}.`);
    }
  }
  for (const key of ['fallbacks', 'refusals', 'totalTasks']) {
    if (!Number.isSafeInteger(record[key]) || record[key] < 0) throw new Error(`Invalid Vals refusal count: ${context}.`);
  }
  if (publishedScore !== null && Math.abs(record.publishedScorePct - publishedScore) > 0.0011
    || record.noFallbackScorePct > record.publishedScorePct + 0.0011) {
    throw new Error(`Vals refusal metadata does not match the published run: ${context}.`);
  }
}
