import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, ItemView } from 'obsidian';
import * as fs from 'fs';
import * as path from 'path';

// Remember to rename these classes and interfaces!

interface PluginSettings {
    selectedFolder: string;
}

const DEFAULT_SETTINGS: PluginSettings = {
    selectedFolder: '/'
};

const VIEW_TYPE_CUSTOM = 'custom-view';

class CustomView extends ItemView {
    constructor(leaf: WorkspaceLeaf, private plugin: MyPlugin) {
        super(leaf);
    }

    getViewType() {
        return VIEW_TYPE_CUSTOM;
    }

    getDisplayText() {
        return 'Custom View';
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();

        // Use selected folder from settings
        const selectedFolder = this.plugin.settings.selectedFolder;

        // Fetch and display folder contents
        const folderContents = await this.getFolderContents(selectedFolder);
        folderContents.forEach(content => {
            const item = container.createDiv({ cls: 'item' });
            item.setText(content);
        });
    }

    async onClose() {
        // Cleanup if necessary
    }

    async getFolderContents(folderPath: string): Promise<string[]> {
        return new Promise((resolve, reject) => {
            const fullPath = this.app.vault.adapter.basePath + path.resolve(folderPath);
            console.log(`Accessing folder: ${fullPath}`);
            fs.readdir(fullPath, { withFileTypes: true }, (err, files) => {
                if (err) {
                    console.error(`Error accessing ${fullPath}:`, err.message);
                    reject(err);
                    return;
                }
                const visibleItems = files
                    .filter(dirent => !dirent.name.startsWith('.'))
                    .map(dirent => dirent.name);
                resolve(visibleItems);
            });
        });
    }
}


export default class MyPlugin extends Plugin {
    settings: PluginSettings;

    async onload() {
        await this.loadSettings();

        this.registerView(
            VIEW_TYPE_CUSTOM,
            (leaf) => new CustomView(leaf, this)
        );

        this.addSettingTab(new SettingTab(this.app, this));

        // This creates an icon in the left ribbon.
        const ribbonIconEl = this.addRibbonIcon('dice', 'Obsidian RPG', (evt: MouseEvent) => {
            // Called when the user clicks the icon.
            // Open a new tab with four columns
            const newLeaf = this.app.workspace.getLeaf(true);
            newLeaf.setViewState({
                type: VIEW_TYPE_CUSTOM,
                active: true
            });
        });
        // Perform additional things with the ribbon
        ribbonIconEl.addClass('obsidian-rpg-ribbon-class');

        // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
        const statusBarItemEl = this.addStatusBarItem();
        statusBarItemEl.setText('Status Bar Text');

        // This adds a simple command that can be triggered anywhere
        this.addCommand({
            id: 'open-sample-modal-simple',
            name: 'Open sample modal (simple)',
            callback: () => {
                new SampleModal(this.app).open();
            }
        });
        // This adds an editor command that can perform some operation on the current editor instance
        this.addCommand({
            id: 'sample-editor-command',
            name: 'Sample editor command',
            editorCallback: (editor: Editor, view: MarkdownView) => {
                console.log(editor.getSelection());
                editor.replaceSelection('Sample Editor Command');
            }
        });
        // This adds a complex command that can check whether the current state of the app allows execution of the command
        this.addCommand({
            id: 'open-sample-modal-complex',
            name: 'Open sample modal (complex)',
            checkCallback: (checking: boolean) => {
                // Conditions to check
                const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (markdownView) {
                    // If checking is true, we're simply "checking" if the command can be run.
                    // If checking is false, then we want to actually perform the operation.
                    if (!checking) {
                        new SampleModal(this.app).open();
                    }

                    // This command will only show up in Command Palette when the check function returns true
                    return true;
                }
            }
        });

        // If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
        // Using this function will automatically remove the event listener when this plugin is disabled.
        this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
            console.log('click', evt);
        });

        // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
        this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
    }

    onunload() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_CUSTOM);
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class SampleModal extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen() {
        const {contentEl} = this;
        contentEl.setText('Woah!');
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}

class SettingTab extends PluginSettingTab {
    plugin: MyPlugin;

    constructor(app: App, plugin: MyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName('Selected Folder')
            .setDesc('Select the folder to display its contents')
            .addText(text => text
                .setPlaceholder('Enter folder path')
                .setValue(this.plugin.settings.selectedFolder)
                .onChange(async (value) => {
                    this.plugin.settings.selectedFolder = value;
                    await this.plugin.saveSettings();
                }));
    }
}
