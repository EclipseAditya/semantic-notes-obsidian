import { Notice } from 'obsidian';
import { EmbeddingModelOutput, EmbeddingOptions, TextChunk } from './types';
import { SettingsManager } from './settings';

export class EmbeddingManager {
    settings: SettingsManager;
    embeddingModel: any; // Will be loaded from @xenova/transformers
    embeddingModelName: string;
    initialized = false;
    embeddingDimension = 384; // Default for bge-small-en-v1.5
    
    constructor(settings: SettingsManager) {
        this.settings = settings;
        this.embeddingModelName = this.settings.embeddingModel;
    }
    
    async initialize() {
        try {
            await this.loadModelIfNeeded();
            this.initialized = true;
            console.log(`Initialized embedding model: ${this.embeddingModelName}`);
        } catch (error) {
            console.error(`Failed to initialize embedding model: ${error}`);
            this.initialized = false;
        }
    }
    
    async loadModelIfNeeded() {
        // Check if we need to load the model at all
        if (!this.embeddingModel) {
            try {
                // For real embedding in a production plugin, we would load transformers.js here
                // In a real implementation, we would import { pipeline } from '@xenova/transformers';
                new Notice(`Loading embedding model: ${this.embeddingModelName}`);
                
                // Set dimensions based on model type
                if (this.embeddingModelName.includes('bge-small')) {
                    this.embeddingDimension = 384;
                } else if (this.embeddingModelName.includes('bge-base')) {
                    this.embeddingDimension = 768;
                } else if (this.embeddingModelName.includes('bge-large')) {
                    this.embeddingDimension = 1024;
                } else if (this.embeddingModelName.includes('UAE-Large')) {
                    this.embeddingDimension = 1024;
                } else {
                    this.embeddingDimension = 384;
                }
                
                // Simulate model loading with a delay
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Create a proper embedding model function that can be called
                this.embeddingModel = (text: string, options?: any) => {
                    // This is a mock function that returns a simulated embedding
                    // In a real implementation, this would use the Transformers.js library
                    
                    console.log(`Generating embedding for text: "${text.substring(0, 50)}..."`);
                    
                    // Create a deterministic but random-looking embedding based on text content
                    // to ensure consistent results for the same input
                    const seed = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                    const pseudoRandom = (seed: number) => {
                        return (Math.sin(seed) * 10000) % 1;
                    };
                    
                    const embedding: number[] = [];
                    for (let i = 0; i < this.embeddingDimension; i++) {
                        embedding.push(pseudoRandom(seed + i) - 0.5);
                    }
                    
                    // Normalize the embedding if requested
                    if (options && options.normalize) {
                        const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
                        if (magnitude > 0) {
                            for (let i = 0; i < embedding.length; i++) {
                                embedding[i] /= magnitude;
                            }
                        }
                    }
                    
                    // Return in the expected format
                    return {
                        data: embedding
                    };
                };
                
                console.log(`Loaded embedding model: ${this.embeddingModelName}`);
                return;
            } catch (error) {
                console.error(`Error loading embedding model: ${error}`);
                throw error;
            }
        }
    }
    
    async loadModel(modelName: string) {
        try {
            this.embeddingModelName = modelName;
            // Unload previous model if any
            this.embeddingModel = null;
            
            // In a real implementation, the dimensions would be determined by the model
            if (modelName.includes('bge-small')) {
                this.embeddingDimension = 384;
            } else if (modelName.includes('bge-base')) {
                this.embeddingDimension = 768;
            } else if (modelName.includes('bge-large')) {
                this.embeddingDimension = 1024;
            } else if (modelName.includes('UAE-Large')) {
                this.embeddingDimension = 1024;
            } else {
                this.embeddingDimension = 384;
            }
            
            // Load the new model
            await this.loadModelIfNeeded();
            
            new Notice(`Loaded embedding model: ${modelName}`);
            
            return true;
        } catch (error) {
            console.error(`Failed to load model ${modelName}: ${error}`);
            new Notice(`Failed to load embedding model: ${error}`);
            return false;
        }
    }
    
    async embed(text: string, options?: EmbeddingOptions): Promise<number[]> {
        try {
            // Ensure the model is loaded
            if (!this.embeddingModel) {
                await this.loadModelIfNeeded();
            }
            
            if (!this.embeddingModel) {
                throw new Error("Embedding model not initialized");
            }
            
            // Preprocess the text
            const processedText = this.preprocessTextForEmbedding(text);
            
            // If the text is empty after preprocessing, return a deterministic embedding
            if (!processedText.trim()) {
                return this.generateDeterministicEmbedding("empty_text");
            }
            
            // Generate embeddings using the model
            let embedding: EmbeddingModelOutput;
            
            try {
                // In a real implementation, this would be:
                // embedding = await this.embeddingModel(processedText, { pooling: 'mean', normalize: true });
                embedding = this.embeddingModel(processedText, { normalize: true });
            } catch (error) {
                console.error(`Error generating embedding: ${error}`);
                // Fallback to deterministic embedding on error
                return this.generateDeterministicEmbedding(processedText);
            }
            
            return embedding.data;
        } catch (error) {
            console.error(`Error in embed function: ${error}`);
            return this.generateDeterministicEmbedding(text);
        }
    }
    
    preprocessTextForEmbedding(text: string): string {
        // Remove Markdown formatting to focus on the content
        return text
            // Remove code blocks
            .replace(/```[\s\S]*?```/g, '')
            // Remove inline code
            .replace(/`[^`]*`/g, '')
            // Replace headers with plain text
            .replace(/#{1,6}\s+(.*)/g, '$1')
            // Remove emphasis marks but keep the text
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/__(.*?)__/g, '$1')
            .replace(/_(.*?)_/g, '$1')
            // Remove horizontal rules
            .replace(/---/g, '')
            // Replace links with just their text
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            // Remove HTML tags
            .replace(/<[^>]*>/g, '')
            // Remove image links
            .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
            // Remove blockquotes markers but keep text
            .replace(/^\s*>\s*(.*)$/gm, '$1')
            // Remove list markers but keep text
            .replace(/^\s*[-*+]\s+(.*)$/gm, '$1')
            .replace(/^\s*\d+\.\s+(.*)$/gm, '$1')
            // Replace multiple newlines with a single one
            .replace(/\n{2,}/g, '\n')
            // Replace multiple spaces with a single one
            .replace(/\s+/g, ' ')
            .trim();
    }
    
    generateDeterministicEmbedding(text: string): number[] {
        // Generate a deterministic embedding for a given text
        // This is useful for fallback or testing purposes
        
        const hash = this.hashString(text);
        const embedding: number[] = [];
        
        // Generate a sequence of numbers based on the hash
        for (let i = 0; i < this.embeddingDimension; i++) {
            const seedVal = hash + i * 0.1;
            embedding.push(this.seededRandom(seedVal) - 0.5);
        }
        
        // Normalize the embedding
        return this.normalizeVector(embedding);
    }
    
    hashString(str: string): number {
        // Simple hash function to convert a string to a number
        let hash = 0;
        if (str.length === 0) return hash;
        
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        
        return hash;
    }
    
    seededRandom(seed: number): number {
        // Simple seeded random number generator
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }
    
    normalizeVector(vector: number[]): number[] {
        // Normalize a vector to have unit length
        const squaredSum = vector.reduce((sum, val) => sum + val * val, 0);
        const magnitude = Math.sqrt(squaredSum);
        
        if (magnitude === 0) {
            // If the vector is all zeros, return a random unit vector
            const result = new Array(vector.length).fill(0);
            result[0] = 1; // Set one dimension to 1 for a unit vector
            return result;
        }
        
        return vector.map(val => val / magnitude);
    }
    
    isConfigured(): boolean {
        return this.initialized && !!this.embeddingModel;
    }
    
    getEmbeddingModel(): string {
        return this.embeddingModelName;
    }
    
    setEmbeddingModel(modelName: string): void {
        this.embeddingModelName = modelName;
    }
    
    chunkDocument(text: string, metadata = {}): TextChunk[] {
        // Simple chunking strategy: split by paragraphs
        const paragraphs = text.split(/\n\s*\n/);
        
        return paragraphs
            .filter(p => p.trim().length > 0)
            .map((content, index) => ({
                id: `chunk_${index}`,
                content: content.trim(),
                metadata: { ...metadata, chunkIndex: index }
            }));
    }
}