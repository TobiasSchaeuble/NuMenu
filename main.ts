import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, ItemView } from 'obsidian';
import * as fs from 'fs';
import * as path from 'path';
import emojiRegex from 'emoji-regex';

// Remember to rename these classes and interfaces!

interface PluginSettings {
    selectedFolder: string;
    fileEmoji: string;
    openOnStartup: boolean;
    defaultEmoji: string;
}

const DEFAULT_SETTINGS: PluginSettings = {
    selectedFolder: '/',
    fileEmoji: '⬜️',
    openOnStartup: false,
    defaultEmoji: '❔',
};

const VIEW_TYPE_OBSIDAN_RPG = 'obsidian-rpg-view';

class ObsidianRPGView extends ItemView {
    private currentFolderPath: string = "";

    constructor(leaf: WorkspaceLeaf, private plugin: ObsidianRPG) {
        super(leaf);
    }

    getViewType() {
        return VIEW_TYPE_OBSIDAN_RPG;
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
                
                // Helper function to extract the first non-emoji character
                const getFirstNonEmojiChar = (name: string) => {
                    const match = name.match(/[\p{L}\p{N}]/u);
                    return match ? match[0] : '';
                };

                // Sort items by the first non-emoji character
                visibleItems.sort((a, b) => {
                    const charA = getFirstNonEmojiChar(a);
                    const charB = getFirstNonEmojiChar(b);
                    return charA.localeCompare(charB);
                });

                // Clear container and display contents
                const container = this.containerEl.children[1];
                container.empty();

                

                // Add class to container
                container.addClass('rpg-view-content');

                visibleItems.forEach((itemName, index) => {
                    const item = container.createDiv({ cls: 'rpg-item' });

                    // Add numbering to each item
                    const numberDiv = item.createDiv({ cls: 'rpg-item-number' });
                    numberDiv.setText((index + 1).toString());

                    if ( itemName.endsWith('.md') ) {
                        // Display the emoji above the file name
                        const emojiDiv = item.createDiv({ cls: 'rpg-item-emoji' });
                        emojiDiv.setText(this.plugin.settings.fileEmoji);

                        const previewDiv = item.createDiv({ cls: 'rpg-item-preview' });
                        // Read the first 33 characters of the file for preview
                        fs.readFile(fullPath + '/' + itemName, 'utf8', (err, data) => {
                            if (err) {
                                console.error(`Error reading file ${fullPath + '/' + itemName}:`, err.message);
                                return;
                            }
                            const previewText = data.slice(0, 42);
                          
                            previewDiv.setText(previewText);
                        });

                        // Display the file name without the .md extension
                        const fileNameWithoutExtension = itemName.replace(/\.md$/, '');
                        const nameDiv = item.createDiv({ cls: 'rpg-item-name' });
                        nameDiv.setText(fileNameWithoutExtension);
                    } else {
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
                            // Use default emoji if no emoji is at the beginning
                            const emojiDiv = item.createDiv({ cls: 'rpg-item-emoji' });
                            emojiDiv.setText(this.plugin.settings.defaultEmoji);
                            const nameDiv = item.createDiv({ cls: 'rpg-item-name' });
                            nameDiv.setText(itemName);
                        }
                    }

                    // Make item clickable
                    item.style.cursor = 'pointer';

                    // Add click event listener
                    item.addEventListener('click', async () => {
                        const fullPath = this.currentFolderPath + itemName;
                        const fullFilePath = this.app.vault.adapter.basePath + path.resolve(fullPath);

                        fs.stat(fullFilePath, (err, stats) => {
                            if (err) {
                                console.error(`Error accessing ${fullFilePath}:`, err.message);
                                return;
                            }
                            if (stats.isFile()) {
                                this.leaf.openFile(this.app.vault.getAbstractFileByPath(fullPath));
                            } else {
                                // Check if the folder contains only one file
                                fs.readdir(fullFilePath, (err, files) => {
                                    if (err) {
                                        console.error(`Error reading directory ${fullFilePath}:`, err.message);
                                        return;
                                    }
                                    if (files.length === 1) {
                                        const singleFilePath = fullPath + "/" + files[0];
                                        this.leaf.openFile(this.app.vault.getAbstractFileByPath(singleFilePath));
                                    } else {
                                        this.currentFolderPath += itemName + "/";
                                        this.getFolderContentsAndPrint(this.currentFolderPath);
                                    }
                                });
                            }
                        });
                    });

                    // Add keyboard shortcut for numbers 1-9
                    if (index < 9) {
                        this.registerDomEvent(document, 'keydown', (evt: KeyboardEvent) => {
                            if (evt.key === (index + 1).toString()) {
                                item.click();
                            }
                        });
                    }
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


export default class ObsidianRPG extends Plugin {
    settings: PluginSettings;

    async onload() {
        await this.loadSettings();

        if (this.settings.openOnStartup) {
            this.app.workspace.onLayoutReady(() => {
                const existingView = this.app.workspace.getLeavesOfType(VIEW_TYPE_OBSIDAN_RPG);
                if (existingView.length === 0) {
                    const newLeaf = this.app.workspace.getLeaf(true);
                    newLeaf.setViewState({
                        type: VIEW_TYPE_OBSIDAN_RPG,
                        active: true
                    });
                    this.app.workspace.revealLeaf(newLeaf);
                }
            });
        }

        // Register the view
        this.registerView(
            VIEW_TYPE_OBSIDAN_RPG,
            (leaf) => new ObsidianRPGView(leaf, this)
        );

        this.addSettingTab(new SettingTab(this.app, this));

        // This creates an icon in the left ribbon.
        const ribbonIconEl = this.addRibbonIcon('dice', 'Obsidian RPG', (evt: MouseEvent) => {
            // Called when the user clicks the icon.
            // Open a new tab with four columns
            const existingView = this.app.workspace.getLeavesOfType(VIEW_TYPE_OBSIDAN_RPG);
            if (existingView.length === 0) {
                const newLeaf = this.app.workspace.getLeaf(true);
                newLeaf.setViewState({
                    type: VIEW_TYPE_OBSIDAN_RPG,
                    active: true
                });
                this.app.workspace.revealLeaf(newLeaf);
            }
        });
        // Perform additional things with the ribbon
        ribbonIconEl.addClass('obsidian-rpg-ribbon-class');

        // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
        // const statusBarItemEl = this.addStatusBarItem();
        // statusBarItemEl.setText('Status Bar Text');


        this.addCommand({
            id: 'open-rpg-plugin',
            name: 'Real Play Game',
            callback: () => {
                const existingView = this.app.workspace.getLeavesOfType(VIEW_TYPE_OBSIDAN_RPG);
                if (existingView.length === 0) {
                    const newLeaf = this.app.workspace.getLeaf(true);
                    newLeaf.setViewState({
                        type: VIEW_TYPE_OBSIDAN_RPG,
                        active: true
                    });
                    this.app.workspace.revealLeaf(newLeaf);
                }
            }
        });



        // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
        this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
    }

    onunload() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_OBSIDAN_RPG);
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
    plugin: ObsidianRPG;

    constructor(app: App, plugin: ObsidianRPG) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName('Select Root Folder')
            .setDesc('Select the folder to display its contents')
            .addText(text => text
                .setPlaceholder('Enter folder path')
                .setValue(this.plugin.settings.selectedFolder)
                .onChange(async (value) => {
                    this.plugin.settings.selectedFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('File Emoji')
            .setDesc('Select the emoji to display above file names')
            .addText(text => text
                .setPlaceholder('Enter file emoji')
                .setValue(this.plugin.settings.fileEmoji)
                .onChange(async (value) => {
                    this.plugin.settings.fileEmoji = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Default Emoji')
            .setDesc('Select the default emoji to display for items without an emoji')
            .addText(text => text
                .setPlaceholder('Enter default emoji')
                .setValue(this.plugin.settings.defaultEmoji)
                .onChange(async (value) => {
                    this.plugin.settings.defaultEmoji = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Open on Startup')
            .setDesc('Automatically open the RPG plugin when Obsidian starts')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.openOnStartup)
                .onChange(async (value) => {
                    this.plugin.settings.openOnStartup = value;
                    await this.plugin.saveSettings();
                }));
    }
}
