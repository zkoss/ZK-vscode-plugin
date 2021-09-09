import * as vscode from 'vscode';
import { XmlSchemaPropertiesArray } from './types';
import XmlSimpleParser from './helpers/xmlsimpleparser';

export default class XmlDefinitionProvider implements vscode.DefinitionProvider {
    private documentListener: vscode.Disposable;
    fileUri: String;
    textDocument: vscode.TextDocument;

    constructor(protected extensionContext: vscode.ExtensionContext, protected schemaPropertiesArray: XmlSchemaPropertiesArray) {
    }
    public dispose(): void {
        this.documentListener.dispose();
    }

    async provideDefinition(textDocument: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) {
        if (token.isCancellationRequested) return [];

        const documentContent = textDocument.getText(),
            offset = textDocument.offsetAt(position),
            scope = await XmlSimpleParser.getScopeForPosition(documentContent, offset),
            wordRange = textDocument.getWordRangeAtPosition(position, /(-?\d*\.\d\w*)|([^\`\~\!\@\#\$\%\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\<\>\/\?\s]+)/g),
            word = textDocument.getText(wordRange);
        if (scope.context == 'link') {
            const AllDocs = await vscode.workspace.findFiles('**/' + word.replace(/\./g, "/") + '.{java}');
            const sourceUri = AllDocs[0];
            let lineAt = 0;
            await vscode.workspace.openTextDocument(sourceUri).then(document => {
                let lineCount = document.lineCount;
                for (let lineNumber = 0; lineNumber < lineCount; lineNumber++) {
                    let lineText = document.lineAt(lineNumber) as any;
                    if (lineText.text.match('class ' + word.substring(word.lastIndexOf('.') + 1))) {
                        lineAt = lineText._line;
                        break;
                    }
                }
            });
            if (wordRange) {
                const location: vscode.DefinitionLink[] = [{
                    targetRange: new vscode.Range(lineAt, 0, lineAt, 1),
                    targetUri: sourceUri,
                    originSelectionRange: wordRange,
                }];
                return location;
            }
        }
    }
}