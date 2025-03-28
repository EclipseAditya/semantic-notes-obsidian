import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import SemanticNotesPlugin from './main';
import { SemanticNotesSettings } from './types';

export class SettingsManager {
    plugin: SemanticNotesPlugin;
    openRouterApiKey: string;
    embeddingModel: string;
    contextLength: number;
    llmModel: string;
    useReranking: boolean;
    usePersistentStorage: boolean;
    
    constructor(plugin: SemanticNotesPlugin) {
        this.plugin = plugin;
        this.openRouterApiKey = '';
        this.embeddingModel = 'Xenova/UAE-Large-V1';
        this.contextLength = 5;
        this.llmModel = 'google/gemini-2.5-pro-exp-03-25:free';
        this.useReranking = true;
        this.usePersistentStorage = true;
    }
    
    async loadSettings() {
        const loadedSettings = await this.plugin.loadData();
        if (loadedSettings) {
            this.openRouterApiKey = loadedSettings.openRouterApiKey || '';
            this.embeddingModel = loadedSettings.embeddingModel || 'Xenova/UAE-Large-V1';
            this.contextLength = loadedSettings.contextLength || 5;
            this.llmModel = loadedSettings.llmModel || 'google/gemini-2.5-pro-exp-03-25:free';
            this.useReranking = loadedSettings.useReranking !== undefined ? loadedSettings.useReranking : true;
            this.usePersistentStorage = loadedSettings.usePersistentStorage !== undefined ? loadedSettings.usePersistentStorage : true;
        }
    }
    
    async saveSettings() {
        await this.plugin.saveData({
            openRouterApiKey: this.openRouterApiKey,
            embeddingModel: this.embeddingModel,
            contextLength: this.contextLength,
            llmModel: this.llmModel,
            useReranking: this.useReranking,
            usePersistentStorage: this.usePersistentStorage
        });
    }
}

export class SemanticNotesSettingTab extends PluginSettingTab {
    plugin: SemanticNotesPlugin;
    
    constructor(app: App, plugin: SemanticNotesPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    
    display(): void {
        const {containerEl} = this;
        containerEl.empty();
        
        containerEl.createEl('h2', {text: 'Semantic Notes Settings'});
        
        // OpenRouter API Key
        new Setting(containerEl)
            .setName('OpenRouter API Key')
            .setDesc('API Key for OpenRouter to access various LLMs')
            .addText(text => text
                .setPlaceholder('Enter your API key')
                .setValue(this.plugin.settings.openRouterApiKey)
                .onChange(async (value) => {
                    this.plugin.settings.openRouterApiKey = value;
                    await this.plugin.settings.saveSettings();
                }));
                
        // Embedding Model
        new Setting(containerEl)
            .setName('Embedding Model')
            .setDesc('Choose the model to use for generating embeddings')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('Xenova/UAE-Large-V1', 'UAE-Large-V1 (Recommended, Best quality)')
                    .addOption('Xenova/bge-small-en-v1.5', 'BGE Small (Fast)')
                    .addOption('Xenova/bge-base-en-v1.5', 'BGE Base (Medium)')
                    .addOption('Xenova/bge-large-en-v1.5', 'BGE Large (High quality, Slow)')
                    .setValue(this.plugin.settings.embeddingModel)
                    .onChange(async (value) => {
                        this.plugin.settings.embeddingModel = value;
                        await this.plugin.settings.saveSettings();
                        await this.plugin.embeddingManager.loadModel(value);
                        new Notice(`Embedding model changed to ${value}. Please re-index notes for best results.`);
                    });
            });
            
        // Use Re-ranking 
        new Setting(containerEl)
            .setName('Use Re-ranking')
            .setDesc('Enable re-ranking of search results for better relevance (recommended)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useReranking)
                .onChange(async (value) => {
                    this.plugin.settings.useReranking = value;
                    await this.plugin.settings.saveSettings();
                    if (value) {
                        new Notice('Re-ranking enabled. This will improve search result quality.');
                    }
                }));
                
        // Enable Persistent Storage
        new Setting(containerEl)
            .setName('Enable Persistent Storage')
            .setDesc('Save embeddings to disk to avoid regenerating them on restart (recommended)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.usePersistentStorage)
                .onChange(async (value) => {
                    this.plugin.settings.usePersistentStorage = value;
                    await this.plugin.settings.saveSettings();
                    if (value) {
                        new Notice('Persistent storage enabled. Embeddings will be saved between sessions.');
                        this.plugin.saveEmbeddingsToDisk();
                    }
                }));
                
        // Context Length
        new Setting(containerEl)
            .setName('Context Length')
            .setDesc('Number of notes to include as context for AI answers')
            .addSlider(slider => slider
                .setLimits(1, 10, 1)
                .setValue(this.plugin.settings.contextLength)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.contextLength = value;
                    await this.plugin.settings.saveSettings();
                }));
                
        // LLM Model
        new Setting(containerEl)
            .setName('LLM Model')
            .setDesc('Choose the language model to use for AI Q&A through OpenRouter')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('google/gemini-2.5-pro-exp-03-25:free', 'Gemini 2.5 Pro (Recommended)')
                    .addOption('google/gemini-2.0-flash-exp:free', 'Gemini Flash (Fast)')
                    .addOption('deepseek/deepseek-r1:free', 'DeepSeek R1 (Powerful)')
                    .addOption('deepseek/deepseek-r1-distill-llama-70b:free', 'DeepSeek R1 Distill')
                    .addOption('mistralai/mistral-7b-instruct:free', 'Mistral 7B Instruct')
                    .setValue(this.plugin.settings.llmModel)
                    .onChange(async (value) => {
                        this.plugin.settings.llmModel = value;
                        await this.plugin.settings.saveSettings();
                        new Notice(`LLM model changed to ${value.split(':')[0].split('/').pop()}`);
                    });
            });
            
        // Re-index All Notes button
        new Setting(containerEl)
            .setName('Re-index All Notes')
            .setDesc('Force re-indexing of all notes (useful after changing embedding model)')
            .addButton(button => button
                .setButtonText("Re-index All Notes")
                .onClick(() => {
                    this.plugin.indexExistingNotes();
                }));
    }
}