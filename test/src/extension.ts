import * as vscode from 'vscode';
import { XmlCompleteSettings, XmlSchemaPropertiesArray } from './types';
import XmlLinterProvider from './linterprovider';
import XmlCompletionItemProvider from './completionitemprovider';
import AutoCompletionProvider from './autocompletionprovider';
import XmlDefinitionProvider from './definitionprovider';

export declare let globalSettings: XmlCompleteSettings;

export const languageId = 'zk';

export const xsdUriString = "http://www.zkoss.org/2005/zul/zul.xsd";

export const schemaId = 'xml2xsd-definition-provider';

export function activate(context: vscode.ExtensionContext): void {

    vscode.workspace.onDidChangeConfiguration(loadConfiguration, undefined, context.subscriptions);
    loadConfiguration();

    const schemaPropertiesArray = new XmlSchemaPropertiesArray();
    const completionitemprovider = vscode.languages.registerCompletionItemProvider(
        { language: languageId, scheme: 'file' },
        new XmlCompletionItemProvider(context, schemaPropertiesArray));

    const definitionprovider = vscode.languages.registerDefinitionProvider(
        { language: languageId, scheme: 'file' },
        new XmlDefinitionProvider(context, schemaPropertiesArray));

    const linterprovider = new XmlLinterProvider(context, schemaPropertiesArray);

    const autocompletionprovider = new AutoCompletionProvider(context, schemaPropertiesArray);

    context.subscriptions.push(
        completionitemprovider,
        definitionprovider,
        linterprovider,
        autocompletionprovider);
}

function loadConfiguration(): void {
    const section = vscode.workspace.getConfiguration('xmlComplete', null);
    globalSettings = new XmlCompleteSettings();
    globalSettings.xsdCachePattern = section.get('xsdCachePattern', undefined);
    globalSettings.formattingStyle = section.get('formattingStyle', "singleLineAttributes");
}

export function deactivate(): void {
    console.debug(`Deactivate XmlComplete`);
}
