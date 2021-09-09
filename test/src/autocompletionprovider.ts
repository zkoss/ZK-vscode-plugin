import * as vscode from 'vscode';
import { languageId } from './extension';
import { XmlSchemaPropertiesArray } from './types';
import XmlSimpleParser from './helpers/xmlsimpleparser';
import { XmlTagCollection, CompletionString } from './types';

export default class AutoCompletionProvider implements vscode.Disposable {

    private documentListener: vscode.Disposable;
    private static maxLineChars = 1024;
    private static maxLines = 8096;
    private delayCount = 0;
    private documentEvent: vscode.TextDocumentChangeEvent;

    constructor(protected extensionContext: vscode.ExtensionContext, protected schemaPropertiesArray: XmlSchemaPropertiesArray) {
        this.documentListener = vscode.workspace.onDidChangeTextDocument(async (evnt) =>
            this.triggerDelayedAutoCompletion(evnt), this, this.extensionContext.subscriptions);
    }

    public dispose(): void {
        this.documentListener.dispose();
    }

    private async triggerDelayedAutoCompletion(documentEvent: vscode.TextDocumentChangeEvent, timeout = 250): Promise<void> {
        if (this.delayCount > 0) {
            this.delayCount = timeout;
            this.documentEvent = documentEvent;
            return;
        }
        this.delayCount = timeout;
        this.documentEvent = documentEvent;

        const tick = 100;

        while (this.delayCount > 0) {
            await new Promise(resolve => setTimeout(resolve, tick));
            this.delayCount -= tick;
        }

        this.triggerAutoCompletion(this.documentEvent);
    }

    private async triggerAutoCompletion(documentEvent: vscode.TextDocumentChangeEvent): Promise<void> {
        const activeTextEditor = vscode.window.activeTextEditor;
        const document = documentEvent.document;
        const inputChange = documentEvent.contentChanges[0];
        if (document.languageId !== languageId
            || documentEvent.contentChanges.length !== 1
            || !inputChange.range.isSingleLine
            || (inputChange.text && inputChange.text.indexOf("\n") >= 0)
            || activeTextEditor === undefined
            || document.lineCount > AutoCompletionProvider.maxLines
            || activeTextEditor.document.uri.toString() !== document.uri.toString()) {
            return;
        }

        const changeLine = inputChange.range.end.line;
        const wholeLineRange = document.lineAt(changeLine).range;
        const wholeLineText = document.getText(document.lineAt(inputChange.range.end.line).range);

        let linePosition = inputChange.range.start.character + inputChange.text.length;

        if (wholeLineText.length >= AutoCompletionProvider.maxLineChars) {
            return;
        }

        const scope = await XmlSimpleParser.getScopeForPosition(`${wholeLineText}\n`, linePosition);

        if (--linePosition < 0) {
            // NOTE: automatic acions require info about previous char
            return;
        }

        const before = wholeLineText.substring(0, linePosition);
        const after = wholeLineText.substring(linePosition);

        if (!(scope.context && scope.context !== "text" && scope.tagName) || inputChange.text == '') {
            // NOTE: unknown scope
            return;
        }

        if (before.substr(before.lastIndexOf("<"), 2) === "</") {
            // NOTE: current position in closing tag
            return;
        }

        // NOTE: auto-change is available only for single tag enclosed in one line
        let closeCurrentTagIndex = after.indexOf(">");
        const nextTagStartPostion = after.indexOf("<");
        const nextTagEndingPostion = nextTagStartPostion >= 0 ? after.indexOf(">", nextTagStartPostion) : -1;
        const invalidTagStartPostion = nextTagEndingPostion >= 0 ? after.indexOf("<", nextTagEndingPostion) : -1;

        let resultText = "",
            isAttrAutoComplete = false;

        if (after.substr(closeCurrentTagIndex - 1).startsWith(`/></${scope.tagName}>`) && closeCurrentTagIndex === 1) {

            resultText = wholeLineText.substring(0, linePosition + nextTagStartPostion) + `` + wholeLineText.substring(linePosition + nextTagEndingPostion + 1);

        } else if (after.substr(closeCurrentTagIndex - 1, 2) !== "/>" && invalidTagStartPostion < 0 || scope.context == 'attribute') {
            if (scope.context == 'attribute') {
                const currentTagCollections: XmlTagCollection[] = [],
                    nodeCacheAttributes = new Map<string, CompletionString[]>(),
                    nsMap = await XmlSimpleParser.getNamespaceMapping(document.getText()),
                    tagName = wholeLineText.substring(wholeLineText.indexOf("<") + 1).split(' ')[0],
                    tagAttribute = wholeLineText.substring(before.lastIndexOf(' ') + 1, linePosition + closeCurrentTagIndex).replace(' ', '').replace('/', '');
                currentTagCollections.push(this.schemaPropertiesArray[0].tagCollection);
                if (!nodeCacheAttributes.has(tagName)) {
                    nodeCacheAttributes.set(tagName, XmlTagCollection.loadAttributesEx(tagName, nsMap, currentTagCollections));
                }
                const attr = nodeCacheAttributes.get(tagName);
                if (attr != undefined && attr.some(sta => sta.name === tagAttribute)) {
                    if (after.includes(' />')) closeCurrentTagIndex = closeCurrentTagIndex - 2;
                    else if (!after.includes('</' + tagName + '>')) closeCurrentTagIndex -= 1;
                    resultText = wholeLineText.substring(0, linePosition + closeCurrentTagIndex) + '=""' + wholeLineText.substring(linePosition + closeCurrentTagIndex);
                    isAttrAutoComplete = true;
                }

            }
            if (nextTagStartPostion >= 0 && after[nextTagStartPostion + 1] === "/" && scope.context != 'attribute') {
                resultText = wholeLineText.substring(0, linePosition + nextTagStartPostion) + `</${scope.tagName}>` + wholeLineText.substring(linePosition + nextTagEndingPostion + 1);
            } else if (after == '/') {
                resultText = wholeLineText.concat(`${scope.tagName}>`);
            } else if (isAttrAutoComplete) {
            } else if (nextTagStartPostion < 0) {
                resultText = wholeLineText.substring(0, linePosition + closeCurrentTagIndex + 1) + `</${scope.tagName}>` + wholeLineText.substring(linePosition + closeCurrentTagIndex + 1);
            }
        }

        if (!resultText || resultText.trim() === wholeLineText.trim()) {
            return;
        }

        resultText = resultText.trimRight();

        let documentContent = document.getText();

        documentContent = documentContent.split("\n")
            .map((l, i) => (i === changeLine) ? resultText : l)
            .join("\n");

        if (!await XmlSimpleParser.checkXml(documentContent)) {
            // NOTE: Check whole document
            return;
        }

        activeTextEditor.edit((builder) => {
            builder.replace(
                new vscode.Range(
                    wholeLineRange.start,
                    wholeLineRange.end),
                resultText);
        }, { undoStopAfter: false, undoStopBefore: false });

        let cursorPositiion;
        if (!isAttrAutoComplete) {
            cursorPositiion = (inputChange.text != '/') ? wholeLineText.length : wholeLineText.length - 2;
        } else {
            cursorPositiion = resultText.lastIndexOf('""') + 1;
        }
        const cursor = activeTextEditor.selection.active;
        const nextCursor = cursor.with(cursor.line, cursorPositiion);
        activeTextEditor.selection = new vscode.Selection(nextCursor, nextCursor);
    }
}