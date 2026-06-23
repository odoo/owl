function getOwlImportEdit(monaco, model, symbol) {
	const doc = model.getValue();

	const importRegex =
		/import\s*\{([^}]*)\}\s*from\s*["']@odoo\/owl["'];?/m;

	const match = importRegex.exec(doc);

	if (match) {
		const imports = match[1]
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);

		if (imports.includes(symbol)) {
			return null;
		}

		imports.push(symbol);

		const start = model.getPositionAt(match.index);
		const end = model.getPositionAt(
			match.index + match[0].length
		);

		return {
			range: new monaco.Range(
				start.lineNumber,
				start.column,
				end.lineNumber,
				end.column
			),
			text: `import { ${imports.join(", ")} } from "@odoo/owl";`,
		};
	}

	return {
		range: new monaco.Range(1, 1, 1, 1),
		text: `import { ${symbol} } from "@odoo/owl";\n`,
	};
}

function isInsideComponentClass(monaco, model, position) {
	const text = model.getValueInRange(
		new monaco.Range(
			1,
			1,
			position.lineNumber,
			position.column
		)
	);

	const matches = [
		...text.matchAll(
			/class\s+\w+\s+extends\s+Component\s*\{/g
		),
	];

	if (!matches.length) {
		return false;
	}

	const lastMatch = matches[matches.length - 1];

	const classBody = text.slice(
		lastMatch.index + lastMatch[0].length
	);

	let depth = 1;

	for (const char of classBody) {
		if (char === "{") depth++;
		if (char === "}") depth--;
	}

	return depth > 0;
}

export function registerOwlSnippets(monaco) {
	return monaco.languages.registerCompletionItemProvider(
		"javascript",
		{
			triggerCharacters: ["c", "p", "s"],

			provideCompletionItems(model, position) {
				const suggestions = [];

				suggestions.push({
					label: "Component class",

					detail: "OWL Component",

					kind:
						monaco.languages.CompletionItemKind.Snippet,

					insertTextRules:
						monaco.languages
							.CompletionItemInsertTextRule
							.InsertAsSnippet,

					insertText: [
						"class ${1:MyComponent} extends Component {",
						'  static template = "${2:my.template}";',
						"",
						"  setup() {",
						"    ${3}",
						"  }",
						"}",
					].join("\n"),

					additionalTextEdits: (() => {
						const edit = getOwlImportEdit(
							monaco,
							model,
							"Component"
						);

						return edit ? [edit] : [];
					})(),
				});

				suggestions.push({
					label: "Plugin class",

					detail: "OWL Plugin",

					kind:
						monaco.languages.CompletionItemKind.Snippet,

					insertTextRules:
						monaco.languages
							.CompletionItemInsertTextRule
							.InsertAsSnippet,

					insertText: [
						"class ${1:MyPlugin} extends Plugin {",
						'  static id = "${2:myPlugin}";',
						"",
						"  setup() {",
						"    ${3}",
						"  }",
						"}",
					].join("\n"),

					additionalTextEdits: (() => {
						const edit = getOwlImportEdit(
							monaco,
							model,
							"Plugin"
						);

						return edit ? [edit] : [];
					})(),
				});

				if (
					isInsideComponentClass(
						monaco,
						model,
						position
					)
				) {
					suggestions.push({
						label: "setup",

						detail: "OWL setup method",

						kind:
							monaco.languages
								.CompletionItemKind.Snippet,

						insertTextRules:
							monaco.languages
								.CompletionItemInsertTextRule
								.InsertAsSnippet,

						insertText: [
							"setup() {",
							"  ${1}",
							"}",
						].join("\n"),
					});
				}

				return {
					suggestions,
				};
			},
		}
	);
}
