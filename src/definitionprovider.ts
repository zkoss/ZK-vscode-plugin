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

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    async provideDefinition(textDocument: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) {
        const documentContent = textDocument.getText();
        const offset = textDocument.offsetAt(position);
        const scope = await XmlSimpleParser.getScopeForPosition(documentContent, offset);
        if (token.isCancellationRequested) return [];

        const wordRange = textDocument.getWordRangeAtPosition(position, /(-?\d*\.\d\w*)|([^\`\~\!\@\#\$\%\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\<\>\/\?\s]+)/g);
        const word = textDocument.getText(wordRange);
        if (scope.context == 'link') {
            const AllDocs = await vscode.workspace.findFiles('**/' + word.replace(/\./g, "/") + '.{java}');
            this.fileUri = AllDocs[0].path;
            this.documentListener = vscode.window.onDidChangeTextEditorSelection(() =>
                this.openFile(this.fileUri));
        }
    }
    private async openFile(uri) {
        if (uri) {
            vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(uri));
            this.fileUri = '';
        }
    }
}