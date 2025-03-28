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
    
    onunload() {
        console.log('Unloading Semantic Notes plugin');
        
        // Save embeddings to disk on unload if persistent storage is enabled
        if (this.settings.usePersistentStorage) {
            this.saveEmbeddingsToDisk();
        }
        
        // Clean up resources
    }
    
    chunkMarkdownContent(markdownContent: string): string[] {
        // Try to chunk by headings first for better semantic sections
        const chunks = this.chunkByHeadings(markdownContent);
        
        // If that didn't produce enough chunks or they're too large,
        // further chunk them by paragraph/size
        const maxChunkSize = 1000; // Maximum recommended chunk size
        const chunkOverlap = 200;  // Overlap between chunks
        
        let finalChunks: string[] = [];
        
        for (const chunk of chunks) {
            if (chunk.length > maxChunkSize) {
                // Further chunk this section
                const subChunks = this.recursivelyChunkText(chunk, maxChunkSize, chunkOverlap);
                finalChunks = finalChunks.concat(subChunks);
            } else if (chunk.trim().length > 0) {
                finalChunks.push(chunk);
            }
        }
        
        return finalChunks;
    }
    
    chunkByHeadings(markdownContent: string): string[] {
        // Split by headings (##, ###, etc.)
        const headingRegex = /^#{1,6}\s+.+$/gm;
        const headingMatches = [...markdownContent.matchAll(headingRegex)];
        
        if (headingMatches.length === 0) {
            // No headings, just return the whole content
            return [markdownContent];
        }
        
        const chunks: string[] = [];
        let currentIndex = 0;
        
        // Process each heading and the content that follows
        for (let i = 0; i < headingMatches.length; i++) {
            const headingMatch = headingMatches[i];
            if (!headingMatch.index) continue;
            
            const headingIndex = headingMatch.index;
            
            // If this isn't the first heading, add the content before it
            if (headingIndex > currentIndex) {
                const chunk = markdownContent.substring(currentIndex, headingIndex).trim();
                if (chunk.length > 0) {
                    chunks.push(chunk);
                }
            }
            
            // Find the end of this heading's content (next heading or end of string)
            const nextHeadingIndex = (i < headingMatches.length - 1 && headingMatches[i + 1].index) 
                ? headingMatches[i + 1].index 
                : markdownContent.length;
            
            // Add the heading and its content
            const headingChunk = markdownContent.substring(headingIndex, nextHeadingIndex).trim();
            if (headingChunk.length > 0) {
                chunks.push(headingChunk);
            }
            
            currentIndex = nextHeadingIndex;
        }
        
        // Add any remaining content after the last heading
        if (currentIndex < markdownContent.length) {
            const chunk = markdownContent.substring(currentIndex).trim();
            if (chunk.length > 0) {
                chunks.push(chunk);
            }
        }
        
        return chunks;
    }
    
    recursivelyChunkText(text: string, chunkSize: number, chunkOverlap: number): string[] {
        // Split by paragraphs first
        const paragraphs = text.split(/\n\s*\n/);
        let chunks: string[] = [];
        let currentChunk = '';
        
        for (const paragraph of paragraphs) {
            const paraText = paragraph.trim();
            if (!paraText) continue;
            
            // If adding this paragraph would make the chunk too big, save current chunk and start a new one
            if (currentChunk && (currentChunk.length + paraText.length > chunkSize)) {
                chunks.push(currentChunk);
                
                // Start new chunk with overlap content from the end of the previous chunk
                if (chunkOverlap > 0 && currentChunk.length > chunkOverlap) {
                    const overlapText = currentChunk.slice(-chunkOverlap);
                    currentChunk = overlapText + '\n\n' + paraText;
                } else {
                    currentChunk = paraText;
                }
            } else {
                // Add to current chunk
                if (currentChunk) {
                    currentChunk += '\n\n' + paraText;
                } else {
                    currentChunk = paraText;
                }
            }
        }
        
        // Add the last chunk if it has content
        if (currentChunk) {
            chunks.push(currentChunk);
        }
        
        return chunks;
    }
    
    async saveEmbeddingsToDisk() {
        try {
            // Check if vector database is initialized and has data
            if (!this.vectorDbManager || this.vectorDbManager.size() === 0) {
                return;
            }
            
            // Get the embeddings from the database
            const embeddingData: SavedData = {
                version: 1,
                modelName: this.embeddingManager.getEmbeddingModel(),
                chunks: [],
                updatedAt: Date.now()
            };
            
            // Add each chunk to the saved data
            for (const [id, chunk] of this.vectorDbManager.db.entries()) {
                if (chunk.embedding) {
                    embeddingData.chunks.push({
                        id: chunk.id,
                        path: chunk.path,
                        text: chunk.text,
                        title: chunk.title,
                        embedding: chunk.embedding,
                        mtime: chunk.mtime || Date.now()
                    });
                }
            }
            
            // Save to data.json file
            await this.saveData(embeddingData);
            
            console.log(`Saved ${embeddingData.chunks.length} chunks to disk`);
        } catch (error) {
            console.error('Error saving embeddings to disk:', error);
        }
    }
    
    async loadEmbeddingsFromDisk(): Promise<boolean> {
        try {
            // Load saved data
            const savedData = await this.loadData() as SavedData | null;
            if (!savedData || !savedData.chunks || savedData.chunks.length === 0) {
                console.log('No embeddings found on disk');
                return false;
            }
            
            // Make sure the embedding model matches
            if (savedData.modelName !== this.embeddingManager.getEmbeddingModel()) {
                console.log(`Embedding model changed (${savedData.modelName} -> ${this.embeddingManager.getEmbeddingModel()}), not loading saved embeddings`);
                return false;
            }
            
            // Clear any existing data
            this.vectorDbManager.clear();
            
            // Add each chunk to the database
            for (const chunk of savedData.chunks) {
                if (chunk.embedding) {
                    this.vectorDbManager.addChunk({
                        id: chunk.id,
                        text: chunk.text,
                        path: chunk.path,
                        title: chunk.title,
                        embedding: chunk.embedding,
                        mtime: chunk.mtime || Date.now()
                    });
                }
            }
            
            console.log(`Loaded ${savedData.chunks.length} chunks from disk`);
            new Notice(`Loaded ${savedData.chunks.length} note chunks from disk`);
            return true;
        } catch (error) {
            console.error('Error loading embeddings from disk:', error);
            return false;
        }
    }
}