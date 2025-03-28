import { App, Modal, Setting, Notice, MarkdownRenderer, TFile, Component, WorkspaceLeaf } from 'obsidian';
import SemanticNotesPlugin from './main';
import { SearchResult } from './types';

declare module 'obsidian' {
    interface WorkspaceLeaf {
        openFile(file: TFile): Promise<void>;
    }
}

export class SemanticSearchModal extends Modal {
    app: App;
    plugin: SemanticNotesPlugin;
    vectorDbManager: any;
    embeddingManager: any;
    settings: any;
    searchSetting: Setting;
    resultsContainer: HTMLElement;
    contentEl: HTMLElement;
    
    constructor(app: App, plugin: SemanticNotesPlugin) {
        super(app);
        this.app = app;
        this.plugin = plugin;
        this.vectorDbManager = plugin.vectorDbManager;
        this.embeddingManager = plugin.embeddingManager;
        this.settings = plugin.settings;
    }
    
    onOpen() {
        const { contentEl } = this;
        
        // Add title
        contentEl.createEl('h2', { text: 'Semantic Search' });
        
        // Create container
        const container = contentEl.createDiv({ cls: 'semantic-search-container' });
        
        // Create search input
        const searchContainer = container.createDiv({ cls: 'search-container' });
        
        const searchSetting = new Setting(searchContainer)
            .setName('Search Query')
            .setDesc('Enter a natural language query to search for semantically similar content')
            .addText(text => {
                text.setPlaceholder('e.g., "How does quantum entanglement work?"')
                    .onChange(async (value: string) => {
                        // No immediate search on change
                    });
                
                // Focus on the search input when modal opens
                setTimeout(() => {
                    text.inputEl.focus();
                }, 10);
                
                // Add event listener for key press
                text.inputEl.addEventListener('keydown', async (e: KeyboardEvent) => {
                    if (e.key === 'Enter') {
                        await this.performSearch(text.getValue());
                    }
                });
            });
        
        // Add search button
        searchSetting.addButton(button => {
            button.setButtonText('Search')
                .setCta()
                .onClick(async () => {
                    const input = searchSetting.controlEl.querySelector('input');
                    if (input) {
                        const query = input.value;
                        await this.performSearch(query);
                    }
                });
        });
        
        // Create results container
        const resultsContainer = container.createDiv({ cls: 'search-results-container' });
        resultsContainer.createEl('p', { text: 'Enter a query and click Search to find semantically similar content in your notes.' });
        
        // Save references to UI elements
        this.contentEl = contentEl;
        this.searchSetting = searchSetting;
        this.resultsContainer = resultsContainer;
    }
    
    async performSearch(query: string) {
        if (!query || query.trim().length === 0) {
            new Notice('Please enter a search query');
            return;
        }
        
        // Show loading message
        this.resultsContainer.empty();
        this.resultsContainer.createEl('p', { text: 'Searching...' });
        
        try {
            // Perform the search
            const limit = 5;
            const useReranking = this.settings.useReranking;
            const results = await this.vectorDbManager.searchSimilar(query, this.embeddingManager, limit, useReranking);
            
            // Store the results for reference
            this.plugin.lastResults = results;
            
            // Display the results
            this.renderResults(results);
        } catch (error: any) {
            console.error("Search error:", error);
            this.resultsContainer.empty();
            this.resultsContainer.createEl('p', { text: `Error: ${error.message}` });
        }
    }
    
    renderResults(results: SearchResult[]) {
        const { resultsContainer } = this;
        resultsContainer.empty();
        
        if (results.length === 0) {
            resultsContainer.createEl('p', { text: 'No results found. Try a different query.' });
            return;
        }
        
        // Create results heading
        resultsContainer.createEl('h3', { text: 'Search Results' });
        
        // Create results list
        const resultsList = resultsContainer.createEl('div', { cls: 'search-results-list' });
        
        // Add each result
        results.forEach((result, index) => {
            const resultItem = resultsList.createEl('div', { cls: 'search-result-item' });
            
            // Result header with title and score
            const resultHeader = resultItem.createEl('div', { cls: 'search-result-header' });
            
            resultHeader.createEl('span', { 
                cls: 'search-result-title',
                text: `${index + 1}. ${result.title}`
            });
            
            resultHeader.createEl('span', { 
                cls: 'search-result-score',
                text: `Score: ${(result.score * 100).toFixed(2)}%`
            });
            
            // Result path
            resultItem.createEl('div', { 
                cls: 'search-result-path',
                text: result.path
            });
            
            // Result content
            const resultContent = resultItem.createEl('div', { cls: 'search-result-content' });
            
            // Get search query from input
            const input = this.searchSetting.controlEl.querySelector('input');
            const searchQuery = input ? input.value : '';
            
            // Use Markdown renderer to render the content
            MarkdownRenderer.renderMarkdown(
                this.highlightQueryTerms(result.text, searchQuery),
                resultContent,
                result.path,
                {} as Component
            );
            
            // Add button to open the note
            const openNoteBtn = resultItem.createEl('button', {
                cls: 'search-result-open-note',
                text: 'Open Note'
            });
            
            openNoteBtn.addEventListener('click', () => {
                // Try to find the file in the vault
                const file = this.app.vault.getAbstractFileByPath(result.path);
                if (file && file instanceof TFile) {
                    const leaf = this.app.workspace.getLeaf();
                    if (leaf) {
                        leaf.openFile(file).then(() => this.close());
                    }
                } else {
                    new Notice(`File not found: ${result.path}`);
                }
            });
            
            // Add a separator except for the last item
            if (index < results.length - 1) {
                resultsList.createEl('hr');
            }
        });
    }
    
    highlightQueryTerms(text: string, query: string): string {
        if (!query) return text;
        
        // Break the query into words
        const words = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
        
        // Remove duplicates
        const uniqueWords = [...new Set(words)];
        
        // Escape special regex characters
        const escapedWords = uniqueWords.map(word => 
            word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        );
        
        if (escapedWords.length === 0) return text;
        
        // Create regex to find the words
        const regex = new RegExp(`(${escapedWords.join('|')})`, 'gi');
        
        // Highlight the matched words
        return text.replace(regex, '**$1**');
    }
    
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

export class AskQuestionModal extends Modal {
    app: App;
    plugin: SemanticNotesPlugin;
    questionSetting: Setting;
    answerContainer: HTMLElement;
    sourcesContainer: HTMLElement;
    contentEl: HTMLElement;
    
    constructor(app: App, plugin: SemanticNotesPlugin) {
        super(app);
        this.app = app;
        this.plugin = plugin;
    }
    
    onOpen() {
        const { contentEl } = this;
        
        // Add title
        contentEl.createEl('h2', { text: 'Ask AI a Question' });
        
        // Create container
        const container = contentEl.createDiv({ cls: 'ask-question-container' });
        
        // Create question input
        const questionContainer = container.createDiv({ cls: 'question-container' });
        
        const questionSetting = new Setting(questionContainer)
            .setName('Question')
            .setDesc('Ask a question about your notes')
            .addText(text => {
                text.setPlaceholder('e.g., "What are the key points about climate change in my notes?"')
                    .onChange(async (value: string) => {
                        // No immediate action on change
                    });
                
                // Focus on the question input when modal opens
                setTimeout(() => {
                    text.inputEl.focus();
                }, 10);
                
                // Add event listener for key press
                text.inputEl.addEventListener('keydown', async (e: KeyboardEvent) => {
                    if (e.key === 'Enter') {
                        await this.askQuestion(text.getValue());
                    }
                });
            });
        
        // Add ask button
        questionSetting.addButton(button => {
            button.setButtonText('Ask')
                .setCta()
                .onClick(async () => {
                    const input = questionSetting.controlEl.querySelector('input');
                    if (input) {
                        const question = input.value;
                        await this.askQuestion(question);
                    }
                });
        });
        
        // Create answer container
        const answerContainer = container.createDiv({ cls: 'answer-container' });
        answerContainer.createEl('p', { text: 'Enter a question and click Ask to get an AI-generated answer based on your notes.' });
        
        // Create sources container
        const sourcesContainer = container.createDiv({ cls: 'sources-container' });
        sourcesContainer.style.display = 'none'; // Hide initially
        
        // Save references to UI elements
        this.contentEl = contentEl;
        this.questionSetting = questionSetting;
        this.answerContainer = answerContainer;
        this.sourcesContainer = sourcesContainer;
    }
    
    async askQuestion(question: string) {
        if (!question || question.trim().length === 0) {
            new Notice('Please enter a question');
            return;
        }
        
        if (!this.plugin.settings.openRouterApiKey) {
            new Notice('Please configure an OpenRouter API key in the plugin settings');
            return;
        }
        
        // Show loading message
        this.answerContainer.empty();
        this.answerContainer.createEl('p', { text: 'Generating answer...' });
        
        // Hide sources while loading
        this.sourcesContainer.style.display = 'none';
        
        try {
            // Call the RAG service to get an answer
            const result = await this.plugin.ragService.answerQuestion(
                question,
                this.plugin.vectorDbManager,
                this.plugin.embeddingManager
            );
            
            // Display the answer
            this.renderAnswer(result.answer);
            
            // Display sources if available
            if (result.shouldShowSources && result.sources.length > 0) {
                this.renderSources(result.sources);
                this.sourcesContainer.style.display = 'block';
            } else {
                this.sourcesContainer.style.display = 'none';
            }
        } catch (error: any) {
            console.error("Error asking question:", error);
            this.answerContainer.empty();
            this.answerContainer.createEl('p', { text: `Error: ${error.message}` });
            this.sourcesContainer.style.display = 'none';
        }
    }
    
    renderAnswer(answer: string) {
        const { answerContainer } = this;
        answerContainer.empty();
        
        // Create answer heading
        answerContainer.createEl('h3', { text: 'Answer' });
        
        // Create answer content
        const answerContent = answerContainer.createEl('div', { cls: 'answer-content' });
        
        // Render the answer as markdown
        MarkdownRenderer.renderMarkdown(
            answer,
            answerContent,
            '',
            {} as Component
        );
    }
    
    renderSources(sources: SearchResult[]) {
        const { sourcesContainer } = this;
        sourcesContainer.empty();
        
        // Create sources heading
        sourcesContainer.createEl('h3', { text: 'Sources' });
        
        // Create sources list
        const sourcesList = sourcesContainer.createEl('div', { cls: 'sources-list' });
        
        // Add each source
        sources.forEach((source, index) => {
            const sourceItem = sourcesList.createEl('div', { cls: 'source-item' });
            
            // Source title
            sourceItem.createEl('div', { 
                cls: 'source-title',
                text: `${index + 1}. ${source.title}`
            });
            
            // Source path
            sourceItem.createEl('div', { 
                cls: 'source-path',
                text: source.path
            });
            
            // Add button to open the note
            const openNoteBtn = sourceItem.createEl('button', {
                cls: 'source-open-note',
                text: 'Open Note'
            });
            
            openNoteBtn.addEventListener('click', () => {
                // Try to find the file in the vault
                const file = this.app.vault.getAbstractFileByPath(source.path);
                if (file && file instanceof TFile) {
                    const leaf = this.app.workspace.getLeaf();
                    if (leaf) {
                        leaf.openFile(file).then(() => this.close());
                    }
                } else {
                    new Notice(`File not found: ${source.path}`);
                }
            });
            
            // Add a separator except for the last item
            if (index < sources.length - 1) {
                sourcesList.createEl('hr');
            }
        });
    }
    
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}