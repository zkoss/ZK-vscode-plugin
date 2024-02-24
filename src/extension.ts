import * as vscode from 'vscode';
import { XmlCompleteSettings, XmlSchemaPropertiesArray } from './types';
import XmlLinterProvider from './linterprovider';
import XmlCompletionItemProvider from './completionitemprovider';
import AutoCompletionProvider from './autocompletionprovider';
import XmlDefinitionProvider from './definitionprovider';
import XsdCachedLoader from './helpers/xsdcachedloader';

import XmlFormatProvider from './formatprovider';
import XmlRangeFormatProvider from './rangeformatprovider';

export declare let globalSettings: XmlCompleteSettings;

export const languageId = 'zk';

export const xsdUriString = "http://www.zkoss.org/2005/zul/zul.xsd";

export const schemaId = 'xml2xsd-definition-provider';

export function activate(context: vscode.ExtensionContext): void {

    vscode.workspace.onDidChangeConfiguration(loadConfiguration, undefined, context.subscriptions);
    loadConfiguration();
    loadWelcomeMsg();

    const schemaPropertiesArray = new XmlSchemaPropertiesArray();
    const completionitemprovider = vscode.languages.registerCompletionItemProvider(
        { language: languageId, scheme: 'file' },
        new XmlCompletionItemProvider(context, schemaPropertiesArray));

    const definitionprovider = vscode.languages.registerDefinitionProvider(
        { language: languageId, scheme: 'file' },
        new XmlDefinitionProvider(context, schemaPropertiesArray));

    const linterprovider = new XmlLinterProvider(context, schemaPropertiesArray);

    const autocompletionprovider = new AutoCompletionProvider(context, schemaPropertiesArray);

    const formatprovider = vscode.languages.registerDocumentFormattingEditProvider(
        { language: languageId, scheme: 'file' },
        new XmlFormatProvider(context, schemaPropertiesArray));

    const rangeformatprovider = vscode.languages.registerDocumentRangeFormattingEditProvider(
        { language: languageId, scheme: 'file' },
        new XmlRangeFormatProvider(context, schemaPropertiesArray));

    context.subscriptions.push(
        completionitemprovider,
        formatprovider,
        rangeformatprovider,
        definitionprovider,
        linterprovider,
        autocompletionprovider);
}

function loadConfiguration(): void {
    const section = vscode.workspace.getConfiguration('xmlComplete', null);
    globalSettings = new XmlCompleteSettings();
    globalSettings.xsdCachePattern = section.get('xsdCachePattern', undefined);
}

async function loadWelcomeMsg() {
    const content = (await XsdCachedLoader.loadSchemaContentsFromUri('https://www.zkoss.org/', true, globalSettings.xsdCachePattern)).data.replace(' ', ''),
        newsBox = content.substring(content.indexOf('row-news-inner-box'));
    // eslint-disable-next-line prefer-const
    let news = newsBox.substring(newsBox.indexOf('\<span\>') + 6, newsBox.indexOf('\<\/span\>'));
    const fs = require('fs');
    const wsedit = new vscode.WorkspaceEdit();
    let filePath;
    if (vscode.workspace.workspaceFolders)
        filePath = vscode.workspace.workspaceFolders[0].uri.fsPath + '/.vscode/zkNews.txt';
    wsedit.createFile(vscode.Uri.file(filePath), { ignoreIfExists: true });

    fs.readFile(filePath, function (error, data) {
        if ((error && error.code == 'ENOENT') || data.toString() != news || data.toString() == '') {
            if (!news.endsWith('!') && !news.endsWith('.'))
                news += '.';
            vscode.window.showInformationMessage(news + ' Visit zkoss.org for details.', 'GO')
                .then((selection) => {
                    if (selection != undefined)
                        vscode.env.openExternal(vscode.Uri.parse('https://www.zkoss.org/?ide=vs&fetch=true&read=more#news-sec'));
                });
            fs.writeFile(filePath, news, function (error) {
                if (error) return;
            })
        }
    }),
        vscode.workspace.applyEdit(wsedit);
}