import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const backendBlocksFile = path.join(repoRoot, 'apps', 'backend', 'src', 'blocks.ts');
const blockCatalogueFile = path.join(repoRoot, 'packages', 'block-catalogue', 'src', 'index.ts');
const frontendEventSchemaFile = path.join(
  repoRoot,
  'apps',
  'frontend',
  'app',
  'lib',
  'event-schema.ts',
);
const frontendBlockConfigFieldsFile = path.join(
  repoRoot,
  'apps',
  'frontend',
  'app',
  'components',
  'pipeline-block-editor-fields.tsx',
);
const pipelineRunnerFile = path.join(repoRoot, 'packages', 'core', 'src', 'pipeline-runner.ts');
const coreIndexFile = path.join(repoRoot, 'packages', 'core', 'src', 'index.ts');
const systemsIndexFile = path.join(repoRoot, 'packages', 'systems', 'src', 'index.ts');
const gameSystemRegistryFile = path.join(
  repoRoot,
  'packages',
  'systems',
  'src',
  'game-system-registry.ts',
);

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readSourceFile(filePath) {
  const text = readText(filePath);
  const scriptKind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, scriptKind);
}

function visit(node, cb) {
  cb(node);
  ts.forEachChild(node, (child) => visit(child, cb));
}

function getPropertyNameText(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  if (ts.isComputedPropertyName(name)) {
    const expression = name.expression;
    if (ts.isStringLiteral(expression) || ts.isIdentifier(expression)) {
      return expression.text;
    }
  }

  return null;
}

function getStringLiteralText(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }

  return null;
}

function getObjectProperty(objectNode, propertyName) {
  for (const property of objectNode.properties) {
    if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) {
      continue;
    }

    const nameText = getPropertyNameText(property.name);
    if (nameText === propertyName) {
      return property;
    }
  }

  return null;
}

function unwrapExpression(node) {
  let current = node;

  while (
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isTypeAssertionExpression(current)
  ) {
    current = current.expression;
  }

  return current;
}

function getObjectKeys(objectNode) {
  return objectNode.properties
    .map((property) => {
      if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) {
        return null;
      }

      return getPropertyNameText(property.name);
    })
    .filter((value) => typeof value === 'string');
}

function getStringArrayElements(arrayNode) {
  return arrayNode.elements
    .map((element) => getStringLiteralText(element))
    .filter((value) => typeof value === 'string');
}

function resolveModuleFile(fromFile, moduleSpecifier) {
  if (!moduleSpecifier.startsWith('.')) {
    throw new Error(`Cannot resolve non-relative module specifier: ${moduleSpecifier}`);
  }

  const normalizedSpecifier = moduleSpecifier.replace(/\.js$/u, '.ts');
  const directPath = path.resolve(path.dirname(fromFile), normalizedSpecifier);
  if (fs.existsSync(directPath)) {
    return directPath;
  }

  const indexPath = path.resolve(path.dirname(fromFile), moduleSpecifier, 'index.ts');
  if (fs.existsSync(indexPath)) {
    return indexPath;
  }

  throw new Error(`Unable to resolve module "${moduleSpecifier}" from ${fromFile}`);
}

function resolveWorkspacePackageIndex(moduleSpecifier) {
  switch (moduleSpecifier) {
    case '@constancia/core':
      return coreIndexFile;
    case '@constancia/systems':
      return systemsIndexFile;
    default:
      throw new Error(`Unsupported package import in checker: ${moduleSpecifier}`);
  }
}

function resolveExportedSymbol(indexFile, exportedSymbolName) {
  const sourceFile = readSourceFile(indexFile);

  for (const statement of sourceFile.statements) {
    if (
      !ts.isExportDeclaration(statement) ||
      !statement.exportClause ||
      !ts.isNamedExports(statement.exportClause)
    ) {
      continue;
    }

    for (const element of statement.exportClause.elements) {
      const exportedName = element.name.text;
      if (exportedName !== exportedSymbolName) {
        continue;
      }

      const localName = element.propertyName?.text ?? element.name.text;
      const moduleSpecifier = statement.moduleSpecifier
        ? getStringLiteralText(statement.moduleSpecifier)
        : null;

      if (!moduleSpecifier) {
        throw new Error(`Export ${exportedSymbolName} in ${indexFile} has no module specifier`);
      }

      return {
        sourceFilePath: resolveModuleFile(indexFile, moduleSpecifier),
        symbolName: localName,
      };
    }
  }

  throw new Error(`Could not resolve export ${exportedSymbolName} from ${indexFile}`);
}

function extractBlockDefinition(blockSourceFilePath, symbolName) {
  const sourceFile = readSourceFile(blockSourceFilePath);

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    const isExported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (!isExported) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== symbolName) {
        continue;
      }

      if (!declaration.initializer || !ts.isObjectLiteralExpression(declaration.initializer)) {
        throw new Error(`Expected ${symbolName} in ${blockSourceFilePath} to be an object literal`);
      }

      const blockObject = declaration.initializer;
      const typeProperty = getObjectProperty(blockObject, 'type');
      const labelProperty = getObjectProperty(blockObject, 'label');
      const configSchemaProperty = getObjectProperty(blockObject, 'configSchema');

      if (!typeProperty || !ts.isPropertyAssignment(typeProperty)) {
        throw new Error(`Block ${symbolName} in ${blockSourceFilePath} is missing type`);
      }

      if (!labelProperty || !ts.isPropertyAssignment(labelProperty)) {
        throw new Error(`Block ${symbolName} in ${blockSourceFilePath} is missing label`);
      }

      if (!configSchemaProperty || !ts.isPropertyAssignment(configSchemaProperty)) {
        throw new Error(`Block ${symbolName} in ${blockSourceFilePath} is missing configSchema`);
      }

      const type = getStringLiteralText(typeProperty.initializer);
      const label = getStringLiteralText(labelProperty.initializer);
      if (!type || !label) {
        throw new Error(
          `Block ${symbolName} in ${blockSourceFilePath} has a non-literal type or label`,
        );
      }

      let configKeys = [];
      let requiredConfigKeys = [];
      if (ts.isObjectLiteralExpression(configSchemaProperty.initializer)) {
        const propertiesProperty = getObjectProperty(
          configSchemaProperty.initializer,
          'properties',
        );
        if (
          propertiesProperty &&
          ts.isPropertyAssignment(propertiesProperty) &&
          ts.isObjectLiteralExpression(propertiesProperty.initializer)
        ) {
          configKeys = getObjectKeys(propertiesProperty.initializer);
        }

        const requiredProperty = getObjectProperty(configSchemaProperty.initializer, 'required');
        if (
          requiredProperty &&
          ts.isPropertyAssignment(requiredProperty) &&
          ts.isArrayLiteralExpression(requiredProperty.initializer)
        ) {
          requiredConfigKeys = getStringArrayElements(requiredProperty.initializer);
        }
      }

      return {
        symbolName,
        sourceFilePath: blockSourceFilePath,
        type,
        label,
        configKeys,
        requiredConfigKeys,
      };
    }
  }

  throw new Error(`Could not find exported block const ${symbolName} in ${blockSourceFilePath}`);
}

function getNamedImports(sourceFile) {
  const imports = new Map();

  for (const statement of sourceFile.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      const moduleSpecifier = getStringLiteralText(statement.moduleSpecifier);
      if (!moduleSpecifier) {
        continue;
      }

      for (const element of statement.importClause.namedBindings.elements) {
        const localName = element.name.text;
        const importedName = element.propertyName?.text ?? element.name.text;
        imports.set(localName, { importedName, moduleSpecifier });
      }
    }
  }

  return imports;
}

function getIdentifierArray(sourceFile, constName) {
  const array = getConstArrayLiteral(sourceFile, constName);
  if (!array) {
    throw new Error(`Could not parse ${constName} as an array literal`);
  }

  return array.elements.map((element) => {
    if (!ts.isIdentifier(element)) {
      throw new Error(`${constName} contains a non-identifier element`);
    }
    return element.text;
  });
}

function resolveImportedBlock(sourceFilePath, imports, identifier) {
  const importInfo = imports.get(identifier);
  if (!importInfo) {
    throw new Error(`No import found for registered block identifier ${identifier}`);
  }

  if (importInfo.moduleSpecifier.startsWith('@constancia/')) {
    const indexFile = resolveWorkspacePackageIndex(importInfo.moduleSpecifier);
    const resolution = resolveExportedSymbol(indexFile, importInfo.importedName);
    return extractBlockDefinition(resolution.sourceFilePath, resolution.symbolName);
  }

  return extractBlockDefinition(
    resolveModuleFile(sourceFilePath, importInfo.moduleSpecifier),
    importInfo.importedName,
  );
}

function getBackendBlocks() {
  const backendSource = readSourceFile(backendBlocksFile);
  const backendImports = getNamedImports(backendSource);
  const commonBlockIdentifiers = getIdentifierArray(backendSource, 'commonBlocks');

  const systemSource = readSourceFile(gameSystemRegistryFile);
  const systemImports = getNamedImports(systemSource);
  const adapterIdentifiers = getIdentifierArray(systemSource, 'GAME_SYSTEM_ADAPTERS');
  const systemBlockIdentifiers = adapterIdentifiers.flatMap((adapterIdentifier) => {
    const adapter = getConstObjectLiteral(systemSource, adapterIdentifier);
    if (!adapter) {
      throw new Error(`Could not parse game system adapter ${adapterIdentifier}`);
    }

    const blocksProperty = getObjectProperty(adapter, 'blocks');
    if (
      !blocksProperty ||
      !ts.isPropertyAssignment(blocksProperty) ||
      !ts.isArrayLiteralExpression(blocksProperty.initializer)
    ) {
      throw new Error(`Game system adapter ${adapterIdentifier} has no literal blocks array`);
    }

    return blocksProperty.initializer.elements.map((element) => {
      if (!ts.isIdentifier(element)) {
        throw new Error(`Game system adapter ${adapterIdentifier} has a non-identifier block`);
      }
      return element.text;
    });
  });

  return [
    ...commonBlockIdentifiers.map((identifier) =>
      resolveImportedBlock(backendBlocksFile, backendImports, identifier),
    ),
    ...systemBlockIdentifiers.map((identifier) =>
      resolveImportedBlock(gameSystemRegistryFile, systemImports, identifier),
    ),
  ];
}

function getConstObjectLiteral(sourceFile, constName) {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== constName) {
        continue;
      }

      if (declaration.initializer) {
        const initializer = unwrapExpression(declaration.initializer);
        if (ts.isObjectLiteralExpression(initializer)) {
          return initializer;
        }
      }
    }
  }

  return null;
}

function getConstArrayLiteral(sourceFile, constName) {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== constName) {
        continue;
      }

      if (declaration.initializer) {
        const initializer = unwrapExpression(declaration.initializer);
        if (ts.isArrayLiteralExpression(initializer)) {
          return initializer;
        }
      }
    }
  }

  return null;
}

function getFrontendEventSchemaFacts() {
  const sourceFile = readSourceFile(frontendEventSchemaFile);
  const blockTypesNode = getConstArrayLiteral(sourceFile, 'BLOCK_TYPES');
  const blockLabelsNode = getConstObjectLiteral(sourceFile, 'BLOCK_LABELS');
  const defaultConfigsNode = getConstObjectLiteral(sourceFile, 'defaultBlockConfigs');
  const normalizersNode = getConstObjectLiteral(sourceFile, 'pipelineBlockConfigNormalizers');

  if (!normalizersNode) {
    throw new Error('Could not parse frontend pipeline config normalizers');
  }

  if (!blockTypesNode || !blockLabelsNode || !defaultConfigsNode) {
    if (!readText(frontendEventSchemaFile).includes('@constancia/block-catalogue')) {
      throw new Error('Frontend block metadata is neither literal nor catalogue-backed');
    }

    const catalogue = getBlockCatalogueFacts();
    return {
      ...catalogue,
      normalizerTypes: normalizersNode.properties
        .map((property) =>
          ts.isPropertyAssignment(property) ? getPropertyNameText(property.name) : null,
        )
        .filter((value) => typeof value === 'string'),
    };
  }

  const blockTypes = blockTypesNode.elements
    .map((element) => getStringLiteralText(element))
    .filter((value) => typeof value === 'string');

  const blockLabels = {};
  for (const property of blockLabelsNode.properties) {
    if (!ts.isPropertyAssignment(property)) {
      continue;
    }

    const key = getPropertyNameText(property.name);
    const value = getStringLiteralText(property.initializer);
    if (key && value) {
      blockLabels[key] = value;
    }
  }

  const defaultConfigKeysByType = {};
  for (const property of defaultConfigsNode.properties) {
    if (!ts.isPropertyAssignment(property)) {
      continue;
    }

    const key = getPropertyNameText(property.name);
    if (!key || !ts.isObjectLiteralExpression(property.initializer)) {
      continue;
    }

    defaultConfigKeysByType[key] = getObjectKeys(property.initializer);
  }

  const normalizerTypes = normalizersNode.properties
    .map((property) => {
      if (!ts.isPropertyAssignment(property)) {
        return null;
      }

      return getPropertyNameText(property.name);
    })
    .filter((value) => typeof value === 'string');

  return {
    blockTypes,
    blockLabels,
    defaultConfigKeysByType,
    normalizerTypes,
  };
}

function getBlockCatalogueFacts() {
  const sourceFile = readSourceFile(blockCatalogueFile);
  const specsNode = getConstArrayLiteral(sourceFile, 'PIPELINE_BLOCK_SPECS');
  if (!specsNode) {
    throw new Error('Could not parse PIPELINE_BLOCK_SPECS from shared catalogue');
  }

  const blockTypes = [];
  const blockLabels = {};
  const defaultConfigKeysByType = {};
  const editorKinds = new Set();

  for (const rawElement of specsNode.elements) {
    const element = unwrapExpression(rawElement);
    if (!ts.isObjectLiteralExpression(element)) {
      throw new Error('Shared catalogue contains a non-object descriptor');
    }

    const blockTypeProperty = getObjectProperty(element, 'blockType');
    const labelProperty = getObjectProperty(element, 'label');
    const defaultConfigProperty = getObjectProperty(element, 'defaultConfig');
    if (
      !blockTypeProperty ||
      !ts.isPropertyAssignment(blockTypeProperty) ||
      !labelProperty ||
      !ts.isPropertyAssignment(labelProperty) ||
      !defaultConfigProperty ||
      !ts.isPropertyAssignment(defaultConfigProperty) ||
      !ts.isObjectLiteralExpression(defaultConfigProperty.initializer)
    ) {
      throw new Error('Shared catalogue descriptor is missing required metadata');
    }

    const blockType = getStringLiteralText(blockTypeProperty.initializer);
    const label = getStringLiteralText(labelProperty.initializer);
    if (!blockType || !label) {
      throw new Error('Shared catalogue block type and label must be string literals');
    }

    blockTypes.push(blockType);
    blockLabels[blockType] = label;
    defaultConfigKeysByType[blockType] = getObjectKeys(defaultConfigProperty.initializer);

    const editorProperty = getObjectProperty(element, 'editor');
    if (!editorProperty || !ts.isPropertyAssignment(editorProperty)) {
      throw new Error(`Shared catalogue descriptor ${blockType} has no editor metadata`);
    }
    const editor = unwrapExpression(editorProperty.initializer);
    if (!ts.isObjectLiteralExpression(editor)) {
      throw new Error(`Shared catalogue editor ${blockType} is not an object literal`);
    }
    const fieldsProperty = getObjectProperty(editor, 'fields');
    if (
      !fieldsProperty ||
      !ts.isPropertyAssignment(fieldsProperty) ||
      !ts.isArrayLiteralExpression(fieldsProperty.initializer)
    ) {
      throw new Error(`Shared catalogue editor ${blockType} has no literal fields array`);
    }
    for (const rawField of fieldsProperty.initializer.elements) {
      const field = unwrapExpression(rawField);
      if (!ts.isObjectLiteralExpression(field)) continue;
      const kindProperty = getObjectProperty(field, 'kind');
      if (kindProperty && ts.isPropertyAssignment(kindProperty)) {
        const kind = getStringLiteralText(kindProperty.initializer);
        if (kind) editorKinds.add(kind);
      }
    }
  }

  return { blockTypes, blockLabels, defaultConfigKeysByType, editorKinds: [...editorKinds] };
}

function getPipelineEditorAdapterKinds() {
  const sourceFile = readSourceFile(frontendBlockConfigFieldsFile);
  const adapters = getConstObjectLiteral(sourceFile, 'pipelineEditorFieldAdapters');
  if (!adapters) {
    throw new Error('Could not parse pipelineEditorFieldAdapters');
  }

  return adapters.properties
    .map((property) => getPropertyNameText(property.name))
    .filter((value) => typeof value === 'string')
    .sort();
}

function getPipelineRunnerFacts() {
  const sourceFile = readSourceFile(pipelineRunnerFile);
  let usesConfigSchema = false;
  let executesInstanceConfigDirectly = false;

  visit(sourceFile, (node) => {
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
      if (node.expression.text === 'block' && node.name.text === 'configSchema') {
        usesConfigSchema = true;
      }
    }

    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) {
      return;
    }

    if (
      !ts.isIdentifier(node.expression.expression) ||
      node.expression.expression.text !== 'block'
    ) {
      return;
    }

    if (node.expression.name.text !== 'execute') {
      return;
    }

    const [firstArg] = node.arguments;
    if (
      firstArg &&
      ts.isPropertyAccessExpression(firstArg) &&
      ts.isIdentifier(firstArg.expression) &&
      firstArg.expression.text === 'instance' &&
      firstArg.name.text === 'config'
    ) {
      executesInstanceConfigDirectly = true;
    }
  });

  return { usesConfigSchema, executesInstanceConfigDirectly };
}

function difference(left, right) {
  const rightSet = new Set(right);
  return left.filter((item) => !rightSet.has(item));
}

function formatList(items) {
  return items.map((item) => `\`${item}\``).join(', ');
}

function main() {
  const backendBlocks = getBackendBlocks();
  const frontendFacts = getFrontendEventSchemaFacts();
  const catalogueFacts = getBlockCatalogueFacts();
  const editorAdapterKinds = getPipelineEditorAdapterKinds();
  const pipelineRunnerFacts = getPipelineRunnerFacts();

  const backendTypes = backendBlocks.map((block) => block.type);
  const issues = [];
  const warnings = [];

  const missingFrontendBlockTypes = difference(backendTypes, frontendFacts.blockTypes);
  const extraFrontendBlockTypes = difference(frontendFacts.blockTypes, backendTypes);
  if (missingFrontendBlockTypes.length > 0) {
    issues.push(
      `Frontend \`BLOCK_TYPES\` is missing backend-registered block types: ${formatList(missingFrontendBlockTypes)}`,
    );
  }
  if (extraFrontendBlockTypes.length > 0) {
    issues.push(
      `Frontend \`BLOCK_TYPES\` contains non-backend block types: ${formatList(extraFrontendBlockTypes)}`,
    );
  }

  const missingEditorAdapters = difference(catalogueFacts.editorKinds, editorAdapterKinds);
  const extraEditorAdapters = difference(editorAdapterKinds, catalogueFacts.editorKinds);
  if (missingEditorAdapters.length > 0) {
    issues.push(
      `Pipeline editor is missing field adapters required by the catalogue: ${formatList(missingEditorAdapters)}`,
    );
  }
  if (extraEditorAdapters.length > 0) {
    issues.push(
      `Pipeline editor contains adapters unused by the catalogue: ${formatList(extraEditorAdapters)}`,
    );
  }

  const missingDefaultConfigTypes = difference(
    backendTypes,
    Object.keys(frontendFacts.defaultConfigKeysByType),
  );
  if (missingDefaultConfigTypes.length > 0) {
    issues.push(
      `\`defaultBlockConfigs\` is missing entries for backend block types: ${formatList(missingDefaultConfigTypes)}`,
    );
  }

  for (const backendBlock of backendBlocks) {
    const frontendLabel = frontendFacts.blockLabels[backendBlock.type];
    if (!frontendLabel) {
      issues.push(`\`BLOCK_LABELS\` is missing an entry for \`${backendBlock.type}\``);
    } else if (frontendLabel !== backendBlock.label) {
      issues.push(
        `Label drift for \`${backendBlock.type}\`: backend uses ${JSON.stringify(backendBlock.label)} but frontend uses ${JSON.stringify(frontendLabel)}`,
      );
    }

    const frontendConfigKeys = frontendFacts.defaultConfigKeysByType[backendBlock.type] ?? [];
    const missingFrontendConfigKeys = difference(
      backendBlock.requiredConfigKeys,
      frontendConfigKeys,
    );
    const extraFrontendConfigKeys = difference(frontendConfigKeys, backendBlock.configKeys);

    if (missingFrontendConfigKeys.length > 0) {
      issues.push(
        `\`defaultBlockConfigs\` for \`${backendBlock.type}\` is missing required backend config keys: ${formatList(missingFrontendConfigKeys)}`,
      );
    }

    if (extraFrontendConfigKeys.length > 0) {
      issues.push(
        `\`defaultBlockConfigs\` for \`${backendBlock.type}\` contains keys not present in backend configSchema: ${formatList(extraFrontendConfigKeys)}`,
      );
    }
  }

  const invalidNormalizerTypes = difference(
    frontendFacts.normalizerTypes,
    frontendFacts.blockTypes,
  );
  if (invalidNormalizerTypes.length > 0) {
    issues.push(
      `\`pipelineBlockConfigNormalizers\` contains unknown block types: ${formatList(invalidNormalizerTypes)}`,
    );
  }

  if (pipelineRunnerFacts.executesInstanceConfigDirectly && !pipelineRunnerFacts.usesConfigSchema) {
    warnings.push(
      '`PipelineRunner.run` executes `instance.config` directly without an obvious `block.configSchema` runtime validation step.',
    );
  }

  console.log('Constancia block drift check');
  console.log('');
  console.log(`Backend registered block types: ${backendTypes.length}`);
  console.log(`Frontend block types: ${frontendFacts.blockTypes.length}`);
  console.log(`Frontend editor field adapters: ${editorAdapterKinds.length}`);

  if (issues.length === 0) {
    console.log('');
    console.log(
      'No frontend/backend block catalogue drift detected across the current hotspot files.',
    );
  } else {
    console.log('');
    console.log(`Detected ${issues.length} drift issue(s):`);
    for (const issue of issues) {
      console.log(`- ${issue}`);
    }
  }

  if (warnings.length > 0) {
    console.log('');
    console.log(`Advisory hotspot warning(s): ${warnings.length}`);
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
  }

  process.exitCode = issues.length > 0 ? 1 : 0;
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(message);
  process.exitCode = 1;
}
