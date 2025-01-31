import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, ItemView } from 'obsidian';
import * as fs from 'fs';
import * as path from 'path';
import emojiRegex from 'emoji-regex';

// Remember to rename these classes and interfaces!

interface PluginSettings {
    selectedFolder: string;
}

const DEFAULT_SETTINGS: PluginSettings = {
    selectedFolder: '/'
};

const VIEW_TYPE_CUSTOM = 'custom-view';

class CustomView extends ItemView {
    private currentFolderPath: string = "";

    constructor(leaf: WorkspaceLeaf, private plugin: MyPlugin) {
        super(leaf);
    }

    getViewType() {
        return VIEW_TYPE_CUSTOM;
    }

    getDisplayText() {
        return 'Real Play Game';
    }

    async onOpen() {
        const headerContainer = this.containerEl.children[0];
        const navigationContainer = headerContainer.children[0];

        console.log(`Container: `, headerContainer);
        // container.empty();
        // container.addClass('rpg-view-content');

        // Add a 'Back' button
        const backButton = navigationContainer.createEl('button', { text: '<' });
        backButton.addEventListener('click', () => this.navigateBack());

        // console.log(`Clear for `, this.currentFolderPath);

        

        // Handle backspace key
        this.registerDomEvent(document, 'keydown', (evt: KeyboardEvent) => {
            if (evt.key === 'Backspace') {
                this.navigateBack();
            }
        });

        // Use selected folder from settings
        const selectedFolder = this.plugin.settings.selectedFolder;

        // Fetch and display folder contents
        await this.getFolderContentsAndPrint(selectedFolder);
    }

    async onClose() {
        // Cleanup if necessary
    }

    async getFolderContentsAndPrint(folderPath: string): Promise<void> {
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
                
                // Clear container and display contents
                const container = this.containerEl.children[1];
                container.empty();


                

                
                container.addClass('rpg-view-content');


                visibleItems.forEach(itemName => {
                    const item = container.createDiv({ cls: 'rpg-item' });

                    // Use emoji-regex to check if the name starts with an emoji
                    const regex = emojiRegex();
                    const emojiMatch = regex.exec(itemName);
                    if (emojiMatch && emojiMatch.index === 0) {
                        // Display only the emoji
                        const emojiDiv = item.createDiv({ cls: 'rpg-item-emoji' });
                        emojiDiv.setText(emojiMatch[0]);
                        // Display the full name without the emoji below
                        const nameDiv = item.createDiv({ cls: 'rpg-item-name' });
                        nameDiv.setText(itemName.slice(emojiMatch[0].length));
                    } else {
                        const nameDiv = item.createDiv({ cls: 'rpg-item-name' });
                        nameDiv.setText(itemName);
                    }

                    // Make item clickable
                    item.style.cursor = 'pointer';

                    // Add click event listener
                    item.addEventListener('click', async () => {
                        const fullPath = this.currentFolderPath + itemName;
                        const fullFilePath = this.app.vault.adapter.basePath + path.resolve(fullPath);

                        // Check if the item is a file
                        fs.stat(fullFilePath, (err, stats) => {
                            if (err) {
                                console.error(`Error accessing ${fullFilePath}:`, err.message);
                                return;
                            }
                            if (stats.isFile()) {
                                // Open the file in the same leaf
                                this.leaf.openFile(this.app.vault.getAbstractFileByPath(fullPath));
                            } else {
                                // Update the current folder path
                                this.currentFolderPath += itemName + "/";
                                this.getFolderContentsAndPrint(this.currentFolderPath);
                            }
                        });
                    });
                });
                
                resolve();
            });
        });
    }

    private navigateBack() {
        if (this.currentFolderPath) {
            // Remove the last folder from the path
            const pathParts = this.currentFolderPath.split('/').filter(part => part);
            pathParts.pop();
            this.currentFolderPath = pathParts.join('/') + '/';

            // Refresh the folder view
            this.getFolderContentsAndPrint(this.currentFolderPath);
        }
    }
}


export default class MyPlugin extends Plugin {
    settings: PluginSettings;

    async onload() {
        await this.loadSettings();

        // Manually add the CSS file to the document head
        // const link = document.createElement('link');
        // link.rel = 'stylesheet';
        // link.type = 'text/css';
        // link.href = this.app.vault.adapter.basePath + '/styles.css';
        // document.head.appendChild(link);

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
