import { Plugin, TFile, Notice } from 'obsidian';
import { SemanticNotesSettingTab, SettingsManager } from './settings';
import { EmbeddingManager } from './embedding-manager';
import { VectorDatabaseManager } from './vector-database';
import { RAGService } from './rag-service';
import { SemanticSearchModal, AskQuestionModal } from './ui';
import { SearchResult, SavedData } from './types';

import './styles.css';

export default class SemanticNotesPlugin extends Plugin {
    settings: SettingsManager;
    settingsTab: SemanticNotesSettingTab;
    embeddingManager: EmbeddingManager;
    vectorDbManager: VectorDatabaseManager;
    ragService: RAGService;
    lastResults: SearchResult[] = []; // Store last search results for source references
    
    async onload() {
        console.log('Loading Semantic Notes plugin');
        
        // Initialize settings
        this.settings = new SettingsManager(this);
        await this.settings.loadSettings();
        
        // Add settings tab
        this.settingsTab = new SemanticNotesSettingTab(this.app, this);
        this.addSettingTab(this.settingsTab);

        // Initialize components (async operations will continue in background)
        await this.initializeComponents();
        
        // Try to load saved embeddings
        let loadedEmbeddings = false;
        if (this.settings.usePersistentStorage) {
            loadedEmbeddings = await this.loadEmbeddingsFromDisk();
        }
        
        // Add ribbon icon
        const ribbonIconEl = this.addRibbonIcon('brain', 'Semantic Notes', (evt) => {
            new Notice('Semantic Notes plugin is active!');
        });
        
        // Add command to open semantic search
        this.addCommand({
            id: 'open-semantic-search',
            name: 'Open Semantic Search',
            callback: () => {
                this.openSemanticSearch();
            }
        });
        
        // Add command for AI Q&A
        this.addCommand({
            id: 'ask-ai-question',
            name: 'Ask AI a Question',
            callback: () => {
                this.openAskQuestion();
            }
        });
        
        // Register for layout ready event to initialize note indexing
        this.app.workspace.onLayoutReady(() => {
            this.registerFileEvents();
            
            // Only index existing notes if we didn't load from disk
            if (!loadedEmbeddings) {
                this.indexExistingNotes();
            }
        });
        
        // Set up auto-save for embeddings
        if (this.settings.usePersistentStorage) {
            // Save embeddings every 10 minutes and on plugin unload
            this.registerInterval(
                window.setInterval(() => this.saveEmbeddingsToDisk(), 10 * 60 * 1000)
            );
        }
    }
    
    async initializeComponents() {
        try {
            // Initialize embedding manager
            this.embeddingManager = new EmbeddingManager(this.settings);
            await this.embeddingManager.initialize();

            // Initialize vector database
            this.vectorDbManager = new VectorDatabaseManager(this.embeddingManager);
            await this.vectorDbManager.initialize(this.embeddingManager);

            // Initialize RAG service
            this.ragService = new RAGService(this.settings);
            
            new Notice('Semantic Notes initialized successfully!');
        } catch (error) {
            console.error('Failed to initialize components:', error);
            new Notice(`Failed to initialize: ${error.message}`);
        }
    }
    
    registerFileEvents() {
        // Listen for file modifications to update embeddings
        this.registerEvent(
            this.app.vault.on('modify', async (file) => {
                if (file instanceof TFile && file.extension === 'md') {
                    this.indexFile(file);
                }
            })
        );
        
        // Listen for file creation to add embeddings
        this.registerEvent(
            this.app.vault.on('create', async (file) => {
                if (file instanceof TFile && file.extension === 'md') {
                    this.indexFile(file);
                }
            })
        );
        
        // Listen for file deletion to remove embeddings
        this.registerEvent(
            this.app.vault.on('delete', async (file) => {
                if (file instanceof TFile && file.extension === 'md') {
                    this.vectorDbManager.removeFile(file.path);
                }
            })
        );
        
        // Listen for file rename to update embeddings
        this.registerEvent(
            this.app.vault.on('rename', async (file, oldPath) => {
                if (file instanceof TFile && file.extension === 'md') {
                    this.vectorDbManager.removeFile(oldPath);
                    this.indexFile(file);
                }
            })
        );
    }
    
    async indexExistingNotes() {
        try {
            const markdownFiles = this.app.vault.getMarkdownFiles();
            if (markdownFiles.length === 0) {
                return;
            }
            
            new Notice(`Starting to index ${markdownFiles.length} notes...`);
            
            let processed = 0;
            const totalFiles = markdownFiles.length;
            
            for (const file of markdownFiles) {
                await this.indexFile(file, false); // Don't show individual notices
                processed++;
                
                // Show progress every 10 files or at the end
                if (processed % 10 === 0 || processed === totalFiles) {
                    const percentage = Math.round((processed / totalFiles) * 100);
                    new Notice(`Indexing progress: ${processed}/${totalFiles} notes (${percentage}%)`);
                }
            }
            
            new Notice(`Completed indexing ${processed} notes.`);
        } catch (error) {
            console.error("Error indexing existing notes:", error);
            new Notice(`Error indexing notes: ${error.message}`);
        }
    }
    
    /**
     * Index a file in the vector database
     * @param file The file to index
     * @param showNotice Whether to show a notice when indexing
     */
    async indexFile(file: TFile, showNotice = false) {
        try {
            // Make sure we have components initialized
            if (!this.vectorDbManager || !this.embeddingManager) {
                console.log('VectorDB or EmbeddingManager not initialized yet, initializing components first');
                await this.initializeComponents();
            }
            
            // Only index markdown files
            if (file.extension !== 'md') {
                return;
            }
            
            if (showNotice) {
                new Notice(`Indexing ${file.path}...`);
            }
            
            // Get the file content
            const content = await this.app.vault.read(file);
            
            // Use improved chunking strategy
            const chunks = this.chunkMarkdownContent(content);
            
            // Remove any existing chunks for this file
            this.vectorDbManager.removeFile(file.path);
            
            // For each chunk, generate embeddings and add to vector db
            for (let i = 0; i < chunks.length; i++) {
                const chunkText = chunks[i];
                
                if (chunkText.trim().length > 0) {
                    try {
                        // Generate embedding
                        const embedding = await this.embeddingManager.embed(chunkText);
                        
                        // Add to vector database
                        this.vectorDbManager.addChunk({
                            id: `${file.path}-${i}`,
                            text: chunkText,
                            path: file.path,
                            title: file.basename,
                            embedding: embedding,
                            mtime: file.stat.mtime
                        });
                    } catch (err) {
                        console.error(`Error generating embedding for chunk ${i} of ${file.path}:`, err);
                    }
                }
            }
            
            if (showNotice) {
                new Notice(`Finished indexing ${file.path} with ${chunks.length} chunks`);
            }
        } catch (error) {
            console.error(`Error indexing file ${file.path}:`, error);
        }
    }
    
    openSemanticSearch() {
        if (!this.embeddingManager.isConfigured()) {
            new Notice('Please configure the embedding model in settings first');
            return;
        }
        
        new SemanticSearchModal(this.app, this).open();
    }
    
    openAskQuestion() {
        if (!this.embeddingManager.isConfigured()) {
            new Notice('Please configure the embedding model in settings first');
            return;
        }
        
        if (!this.settings.openRouterApiKey) {
            new Notice('Please set your OpenRouter API key in settings first');
            return;
        }
        
        new AskQuestionModal(this.app, this).open();
    }