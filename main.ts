import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, ItemView, TFile, TFolder } from 'obsidian';
import emojiRegex from 'emoji-regex';

// Remember to rename these classes and interfaces!

interface NuMenuSettings {
    fileEmoji: string;
    openOnStartup: boolean;
    reopenExistingView: boolean;
    defaultEmoji: string;
    customOrder: { [folderPath: string]: string[] };
    desktopColumns: number;
    tabletColumns: number;
    phoneColumns: number;
}

const DEFAULT_SETTINGS: NuMenuSettings = {
    fileEmoji: '⬜️',
    openOnStartup: false,
    reopenExistingView: true,
    defaultEmoji: '❔',
    customOrder: {},
    desktopColumns: 4,
    tabletColumns: 2,
    phoneColumns: 1
};

const VIEW_TYPE_NuMenu = 'NuMenu-view';


class NuMenuView extends ItemView {
    private currentFolderPath: string = "";

    constructor(leaf: WorkspaceLeaf, private plugin: NuMenu) {
        super(leaf);
    }

    getViewType() {
        return VIEW_TYPE_NuMenu;
    }

    getDisplayText() {
        return 'NuMenu';
    }    

    updateColumnCount() {
        const isDesktop = this.app.isDesktopApp;
        const isMobile = this.app.isMobileApp;
        let columnCount = this.plugin.settings.desktopColumns;
        if (isMobile) {
            const isTablet = this.app.metadataCache.getFileSize('') > 768;
            columnCount = isTablet ? this.plugin.settings.tabletColumns : this.plugin.settings.phoneColumns;
        }
        this.containerEl.style.setProperty('--numenu-column-count', columnCount.toString());
    }

    async onOpen() {
        const headerContainer = this.containerEl.children[0];
        const navigationContainer = headerContainer.children[0];

        // Add a 'Back' button
        const backButton = navigationContainer.createEl('button', { text: '<' });
        backButton.addEventListener('click', () => this.navigateBack());
        
        // Add a reload button (initially hidden)
        const reloadButton = navigationContainer.createEl('button', { 
            text: '↻',
            cls: 'reload-button hidden'
        });
        reloadButton.addEventListener('click', async () => {
            await this.getFolderContentsAndPrint(this.currentFolderPath);
            reloadButton.addClass('hidden');
        });
        
        // Handle backspace key
        this.registerDomEvent(document, 'keydown', (evt: KeyboardEvent) => {
            if (evt.key === 'Backspace') {
                this.navigateBack();
            }
        });

        // Fetch and display folder contents
        await this.getFolderContentsAndPrint(this.currentFolderPath);

        // Update column count
        this.updateColumnCount();
    }

    async onClose() {
        // Cleanup if necessary
    }

    async getFolderContentsAndPrint(folderPath: string): Promise<void> {

        return new Promise((resolve, reject) => {

            this.app.vault.adapter.list(folderPath).then((result) => {
                const visibleItems = [...result.folders, ...result.files]
                    .filter(object => !object.split('/').pop().startsWith('.'))
                    .map(object => {
                        const parts = object.split('/');
                        return parts[parts.length - 1];
                    });
                
                // Helper function to extract the first non-emoji character
                const getFirstNonEmojiChar = (name: string) => {
                    const match = name.match(/[\p{L}\p{N}]/u);
                    return match ? match[0] : '';
                };

                console.log("---this.plugin.settings.customOrder " + this.plugin.settings.customOrder);

                // Sort items based on custom order if available, otherwise by first non-emoji character
                const customOrder = this.plugin.settings.customOrder[folderPath] || [];
                visibleItems.sort((a, b) => {
                    const indexA = customOrder.indexOf(a);
                    const indexB = customOrder.indexOf(b);
                    
                    // If both items are in custom order, use that order
                    if (indexA !== -1 && indexB !== -1) {
                        return indexA - indexB;
                    }
                    // If only one item is in custom order, prioritize it
                    if (indexA !== -1) return -1;
                    if (indexB !== -1) return 1;
                    
                    // Otherwise, sort by first non-emoji character
                    const charA = getFirstNonEmojiChar(a);
                    const charB = getFirstNonEmojiChar(b);
                    return charA.localeCompare(charB);
                });



                // Clear container and display contents
                const container = this.containerEl.children[1];
                container.empty();

                // Create a container for the items that supports drag and drop
                const itemsContainer = container.createDiv({ cls: 'NuMenu-items-container' });
                
                visibleItems.forEach((itemName, index) => {
                    const item = itemsContainer.createDiv({ cls: 'NuMenu-item' });
                    item.setAttribute('draggable', 'true');
                    item.dataset.name = itemName;

                    // Add drag and drop event listeners
                    item.addEventListener('dragstart', (e) => {
                        e.dataTransfer.setData('text/plain', itemName);
                        item.addClass('dragging');
                    });

                    item.addEventListener('dragend', () => {
                        item.removeClass('dragging');
                    });

                    item.addEventListener('dragover', (e) => {
                        e.preventDefault();
                        const draggingItem = itemsContainer.querySelector('.dragging');
                        if (draggingItem && draggingItem !== item) {
                            const rect = item.getBoundingClientRect();
                            const midY = rect.top + rect.height / 2;
                            if (e.clientY < midY) {
                                item.before(draggingItem);
                            } else {
                                item.after(draggingItem);
                            }
                        }
                    });

                    item.addEventListener('drop', async (e) => {
                        e.preventDefault();
                        // Update the custom order based on the current DOM order
                        const newOrder = Array.from(itemsContainer.children)
                            .map(child => child.dataset.name)
                            .filter(name => name); // Remove any undefined/null values
                        
                        this.plugin.settings.customOrder[folderPath] = newOrder;
                        await this.plugin.saveSettings();

                        // Show the reload button after drag and drop
                        const reloadButton = this.containerEl.querySelector('.reload-button');
                        if (reloadButton) {
                            reloadButton.removeClass('hidden');
                        }
                    });

                    // Add numbering to each item
                    const numberDiv = item.createDiv({ cls: 'NuMenu-item-number' });
                    numberDiv.setText((index + 1).toString());

                    if ( itemName.endsWith('.md') ) {
                        const contentContainer = item.createDiv({ cls: 'NuMenu-item-content' });
                        
                        // Display the emoji above the file name
                        const emojiDiv = contentContainer.createDiv({ cls: 'NuMenu-item-emoji' });
                        emojiDiv.setText(this.plugin.settings.fileEmoji);

                        const previewDiv = item.createDiv({ cls: 'NuMenu-item-preview' });
                        // Read the first 33 characters of the file for preview
                        this.app.vault.adapter.read(folderPath + '/' + itemName).then((data) => {
                            const previewText = data.slice(0, 42);
                            previewDiv.setText(previewText);
                        }).catch((err) => {
                            console.error(`Error reading file ${folderPath + '/' + itemName}:`, err.message);
                        });

                        // Display the file name without the .md extension
                        const fileNameWithoutExtension = itemName.replace(/\.md$/, '');
                        const nameDiv = contentContainer.createDiv({ cls: 'NuMenu-item-name' });
                        nameDiv.setText(fileNameWithoutExtension);
                    } else {
                        const contentContainer = item.createDiv({ cls: 'NuMenu-item-content' });
                        
                        // Use emoji-regex to check if the name starts with an emoji
                        const regex = emojiRegex();
                        const emojiMatch = regex.exec(itemName);
                        if (emojiMatch && emojiMatch.index === 0) {
                            // Display only the emoji
                            const emojiDiv = contentContainer.createDiv({ cls: 'NuMenu-item-emoji' });
                            emojiDiv.setText(emojiMatch[0]);
                            // Display the full name without the emoji below
                            const nameDiv = contentContainer.createDiv({ cls: 'NuMenu-item-name' });
                            nameDiv.setText(itemName.slice(emojiMatch[0].length));
                        } else {
                            // Use default emoji if no emoji is at the beginning
                            const emojiDiv = contentContainer.createDiv({ cls: 'NuMenu-item-emoji' });
                            emojiDiv.setText(this.plugin.settings.defaultEmoji);
                            const nameDiv = contentContainer.createDiv({ cls: 'NuMenu-item-name' });
                            nameDiv.setText(itemName);
                        }
                    }

                    // Make item clickable
                    item.style.cursor = 'pointer';

                    // Add click event listener
                    item.addEventListener('click', async () => {
                        const fullPath = this.currentFolderPath + itemName;
                        const file = this.app.vault.getAbstractFileByPath(fullPath);
                        if (file instanceof TFile) {
                            this.leaf.openFile(file);
                        } else if (file instanceof TFolder) {
                            this.currentFolderPath += itemName + '/';
                            this.getFolderContentsAndPrint(this.currentFolderPath);
                        }
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
            }).catch((err) => {
                console.error(`Error accessing ${folderPath}:`, err.message);
                reject(err);
            });
        });
    }

    private navigateBack() {
        if (this.currentFolderPath !== '/') {
            // Remove the last folder from the path
            const pathParts = this.currentFolderPath.split('/').filter(part => part);
            pathParts.pop();
            this.currentFolderPath = pathParts.join('/');

            // Refresh the folder view
            this.getFolderContentsAndPrint(this.currentFolderPath);
        }
    }
}


export default class NuMenu extends Plugin {
    settings: NuMenuSettings;
    private view: NuMenuView;

    async onload() {
        await this.loadSettings();

        if (this.settings.openOnStartup) {
            this.app.workspace.onLayoutReady(() => {
                const existingView = this.app.workspace.getLeavesOfType(VIEW_TYPE_NuMenu);
                if (existingView.length === 0) {
                    const newLeaf = this.app.workspace.getLeaf(true);
                    newLeaf.setViewState({
                        type: VIEW_TYPE_NuMenu,
                        active: true
                    });
                    this.app.workspace.revealLeaf(newLeaf);
                }
            });
        }

        // Register the view
        this.registerView(
            VIEW_TYPE_NuMenu,
            (leaf) => new NuMenuView(leaf, this)
        );

        // Add a settings tab
        this.addSettingTab(new NuMenuSettingTab(this.app, this));

        // Register for settings changes
        this.registerEvent(
            this.app.workspace.on('layout-change', () => {
                const view = this.app.workspace.getLeavesOfType(VIEW_TYPE_NuMenu)[0]?.view as NuMenuView;
                if (view) {
                    view.updateColumnCount();
                }
            })
        );

        // This creates an icon in the left ribbon.
        const ribbonIconEl = this.addRibbonIcon('dice', 'NuMenu', (evt: MouseEvent) => {
            // Called when the user clicks the icon.
            // Open a new tab with four columns
            this.openNuMenuView();
        });
        // Perform additional things with the ribbon
        ribbonIconEl.addClass('NuMenu-ribbon-class');

        // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
        // const statusBarItemEl = this.addStatusBarItem();
        // statusBarItemEl.setText('Status Bar Text');


        this.addCommand({
            id: 'open-NuMenu-plugin',
            name: 'NuMenu',
            callback: () => {
                this.openNuMenuView();
            }
        });



        // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
        this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
    }

    private openNuMenuView() {
        const existingView = this.app.workspace.getLeavesOfType(VIEW_TYPE_NuMenu);
        if (existingView.length > 0) {
            if (this.settings.reopenExistingView) {
                // Close all existing NuMenu views
                // existingView.forEach(leaf => leaf.detach());
                 // Focus existing view instead of creating a new one
                this.app.workspace.revealLeaf(existingView[0]);
                return;
            }
        }
        
        // Create new NuMenu view
        const newLeaf = this.app.workspace.getLeaf('tab');
        newLeaf.setViewState({
            type: VIEW_TYPE_NuMenu,
            active: true
        });
        this.app.workspace.revealLeaf(newLeaf);
    }

    onunload() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_NuMenu);
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class NuMenuSettingTab extends PluginSettingTab {
    plugin: NuMenu;

    constructor(app: App, plugin: NuMenu) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

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
            .setDesc('Automatically open the NuMenu plugin when Obsidian starts')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.openOnStartup)
                .onChange(async (value) => {
                    this.plugin.settings.openOnStartup = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Reopen Existing View')
            .setDesc('Reopen the existing view instead of creating a new one when the plugin is opened')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.reopenExistingView)
                .onChange(async (value) => {
                    this.plugin.settings.reopenExistingView = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Custom Folder Order')
            .setDesc('Configure custom order for folders (JSON format). Example: {"folder1": ["item1", "item2"], "folder2": ["itemA", "itemB"]}')
            .addTextArea(text => text
                .setValue(JSON.stringify(this.plugin.settings.customOrder, null, 2))
                .onChange(async (value) => {
                    try {
                        const parsed = JSON.parse(value);
                        this.plugin.settings.customOrder = parsed;
                        await this.plugin.saveSettings();
                        new Notice('Custom order saved successfully');
                    } catch (e) {
                        new Notice('Invalid JSON format');
                    }
                }));

        new Setting(containerEl)
            .setName('Reset Custom Order')
            .setDesc('Reset the custom order for all folders. This will restore the default alphabetical sorting.')
            .addButton(button => button
                .setButtonText('Reset Order')
                .onClick(async () => {
                    this.plugin.settings.customOrder = {} as Record<string, string[]>;
                    await this.plugin.saveSettings();
                    new Notice('Custom order has been reset for all folders');
                }));

        new Setting(containerEl)
            .setName('Desktop Columns')
            .setDesc('Number of columns to display in the NuMenu view on desktop (1-4)')
            .addText(text => text
                .setValue(this.plugin.settings.desktopColumns.toString())
                .setPlaceholder('1-4')
                .onChange(async (value) => {
                    const numValue = parseInt(value);
                    if (!isNaN(numValue) && numValue >= 1 && numValue <= 4) {
                        this.plugin.settings.desktopColumns = numValue;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Tablet Columns')
            .setDesc('Number of columns to display in the NuMenu view on tablet (1-4)')
            .addText(text => text
                .setValue(this.plugin.settings.tabletColumns.toString())
                .setPlaceholder('1-4')
                .onChange(async (value) => {
                    const numValue = parseInt(value);
                    if (!isNaN(numValue) && numValue >= 1 && numValue <= 4) {
                        this.plugin.settings.tabletColumns = numValue;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Phone Columns')
            .setDesc('Number of columns to display in the NuMenu view on phone (1-4)')
            .addText(text => text
                .setValue(this.plugin.settings.phoneColumns.toString())
                .setPlaceholder('1-4')
                .onChange(async (value) => {
                    const numValue = parseInt(value);
                    if (!isNaN(numValue) && numValue >= 1 && numValue <= 4) {
                        this.plugin.settings.phoneColumns = numValue;
                        await this.plugin.saveSettings();
                    }
                }));
    }
}
