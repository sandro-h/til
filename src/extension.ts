// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

const fieldDecoration = vscode.window.createTextEditorDecorationType({
	color: '#808080;'
});

const titleDecoration = vscode.window.createTextEditorDecorationType({
	color: 'green; font-weight: bold'
});

interface ExtensionState {
	tags: Set<string>;
	completionTags: vscode.CompletionItem[];
}

const extState: ExtensionState = {
	tags: new Set(),
	completionTags: [],
};

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	activateDocumentListener(context);
	activateCompletion(context);

	scanDocument(vscode.window.activeTextEditor?.document);
}

function activateDocumentListener(context: vscode.ExtensionContext) {

	vscode.window.onDidChangeActiveTextEditor(editor => scanDocument(editor?.document), null, context.subscriptions);

	let debounceTimeout: NodeJS.Timeout | undefined;
	
	vscode.workspace.onDidChangeTextDocument(event => {
		if (isTilDocument(event.document)) {
			if (debounceTimeout) {
				clearTimeout(debounceTimeout);
			}
			debounceTimeout = setTimeout(() => scanDocument(event.document), 300);
		}
	}, null, context.subscriptions);
}

function scanDocument(document: vscode.TextDocument | undefined) {
	if (!document || !isTilDocument(document) || vscode.window.activeTextEditor?.document !== document) {
		return;
	}

	const decorationResult = newDecorationScanContext();
	const tags = new Set<string>();
	for (let i = 0; i < document.lineCount; i++) {
		const line = document.lineAt(i);
		const text = line.text;					
		if (text.startsWith("tags:")) {
			parseTags(text).forEach(t => tags.add(t));
		}
		scanDecoration(line, decorationResult);
	}

	updateTagsIfNeeded(tags);
	decorate(decorationResult);
}

interface DecorationScanResult {
	lastWasDelimiter: boolean
	fields: vscode.Range[];
	titles: vscode.Range[];
}

function newDecorationScanContext(): DecorationScanResult {
	return {
		fields: [],
		titles: [],
		lastWasDelimiter: false
	};
}

function scanDecoration(line: vscode.TextLine, context: DecorationScanResult) {
	const lineIsEmpty = line.text.trim() === '';

	if (line.text.startsWith("tags:") ||
		line.text.startsWith("date:") ||
		line.text.startsWith("guid:")) {
		context.fields.push(line.range);//line.range.with(undefined, line.range.start.translate(0,5)));
	}


	if (line.text.startsWith('----------------------------------------------------------------------')) {
		context.lastWasDelimiter = true;
	}
	else if (!lineIsEmpty) {
		if (context.lastWasDelimiter) {
			context.titles.push(line.range);
		}
		context.lastWasDelimiter = false;
	}
}

function decorate(decorationResult: DecorationScanResult) {
	vscode.window.activeTextEditor?.setDecorations(fieldDecoration, decorationResult.fields);
	vscode.window.activeTextEditor?.setDecorations(titleDecoration, decorationResult.titles);
}

function parseTags(line: string): string[] {
	if (line.startsWith("tags:")) {
		line = line.substring(5);
	}
	return line.split(/\s+/).map(part => {
		part = part.trim();
		if (part.startsWith("#")) {
			part = part.substring(1);
		}
		return part.trim();
	});
}

function updateTagsIfNeeded(tags: Set<string>) {
	if (equalSets(tags, extState.tags)) {
		return;			
	}

	extState.tags = tags;
	extState.completionTags = Array.from(tags).sort().map(t => new vscode.CompletionItem(t, vscode.CompletionItemKind.Constant));
}

function equalSets<T>(s1: Set<T>, s2: Set<T>): boolean {
	if (s1.size !== s2.size) {
		return false;
	}

	for (const e1 of s1) {
		if (!s2.has(e1)) {
			return false;
		}
	}

	return true;
}

function activateCompletion(context: vscode.ExtensionContext) {
	const completionProvider = vscode.languages.registerCompletionItemProvider(
		'plaintext',
		{
			provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {

				const isTilFile = isTilDocument(document);
				const isTagsLine = document.lineAt(position).text.startsWith('tags:');
				if (!isTilFile || !isTagsLine) {
					return undefined;
				}

				return extState.completionTags;
			}
		},
		// Activate when this character is typed:
		'#'
	);

	context.subscriptions.push(completionProvider);
}

function isTilDocument(document: vscode.TextDocument) {
	return document.fileName.endsWith('til.txt');
}

// this method is called when your extension is deactivated
export function deactivate() {}
