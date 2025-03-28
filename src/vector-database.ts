import { EmbeddingManager } from './embedding-manager';
import { SearchResult, TextChunk } from './types';

export class VectorDatabaseManager {
    db = new Map<string, TextChunk>();
    embeddingManager: EmbeddingManager;
    initialized = false;
    rerankerModel = null;
    
    constructor(embeddingManager: EmbeddingManager) {
        this.embeddingManager = embeddingManager;
    }
    
    async initialize(embeddingManager: EmbeddingManager) {
        this.embeddingManager = embeddingManager;
        this.initialized = true;
    }
    
    async indexFile(path: string, content: string, embeddingManager: EmbeddingManager) {
        try {
            // Generate chunks from the content
            const chunks = this.embeddingManager.chunkDocument(content, {
                path: path,
                title: path.split('/').pop() || path
            });
            
            // Generate embeddings for each chunk and add to the database
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                
                // Generate embedding
                const embedding = await this.embeddingManager.embed(chunk.text);
                
                // Add to database
                this.addChunk({
                    id: `${path}-${i}`,
                    text: chunk.text,
                    path: path,
                    title: chunk.title,
                    embedding: embedding,
                    mtime: chunk.mtime || Date.now()
                });
            }
            
            return chunks.length;
        } catch (error) {
            console.error(`Error indexing file ${path}:`, error);
            return 0;
        }
    }
    
    removeFile(path: string) {
        // Remove all chunks from this file
        let removed = 0;
        for (const [id, chunk] of this.db.entries()) {
            if (chunk.path === path) {
                this.db.delete(id);
                removed++;
            }
        }
        return removed;
    }
    
    addChunk(chunk: TextChunk) {
        this.db.set(chunk.id, chunk);
    }
    
    async rerankResults(query: string, results: SearchResult[]) {
        // For now, we're implementing a simpler re-ranking approach
        return this.rerankResultsImproved(query, results);
    }
    
    async searchSimilar(query: string, embeddingManager: EmbeddingManager, limit = 5, useReranking = false): Promise<SearchResult[]> {
        try {
            if (this.db.size === 0) {
                return [];
            }
            
            // Generate embedding for the query
            const queryEmbedding = await embeddingManager.embed(query);
            
            // Get all chunks with their similarity scores
            const scoredChunks: {
                chunk: TextChunk,
                score: number,
                hasExactMatch: boolean
            }[] = [];
            
            // Search for chunks with similar embeddings
            for (const chunk of this.db.values()) {
                // Skip chunks without embeddings
                if (!chunk.embedding || chunk.embedding.length === 0) {
                    continue;
                }
                
                // Calculate cosine similarity
                const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);
                
                // Check for exact match
                const hasExactMatch = this.exactMatch(query, chunk.text);
                
                // Add to results
                scoredChunks.push({
                    chunk,
                    score: similarity,
                    hasExactMatch
                });
            }
            
            // Boost scores for chunks with exact matches
            const boostFactor = 0.3; // Adjust boost factor as needed
            for (const scoredChunk of scoredChunks) {
                if (scoredChunk.hasExactMatch) {
                    scoredChunk.score += boostFactor;
                }
            }
            
            // Sort by similarity score (descending)
            scoredChunks.sort((a, b) => b.score - a.score);
            
            // Select top results
            const topResults = scoredChunks.slice(0, limit * 2); // Get more results than needed for reranking
            
            // Format results
            let formattedResults = topResults.map(item => ({
                path: item.chunk.path,
                title: item.chunk.title,
                text: item.chunk.text,
                score: item.score
            }));
            
            // Apply reranking if enabled
            if (useReranking) {
                formattedResults = await this.rerankResults(query, formattedResults);
                // Limit to requested number
                formattedResults = formattedResults.slice(0, limit);
            } else {
                // Just use top results without reranking
                formattedResults = formattedResults.slice(0, limit);
            }
            
            return formattedResults;
        } catch (error) {
            console.error('Error in searchSimilar:', error);
            return [];
        }
    }
    
    async rerankResultsImproved(query: string, results: SearchResult[], limit = 5): Promise<SearchResult[]> {
        // A more sophisticated re-ranking approach using multiple factors
        
        // Helper function for exact match detection
        const exactMatch = (text: string) => {
            // Normalize strings for comparison
            const normalizedQuery = query.toLowerCase().trim();
            const normalizedText = text.toLowerCase();
            
            // Simple exact match (case insensitive)
            if (normalizedText.includes(normalizedQuery)) {
                return true;
            }
            
            // Tokenize the query and text
            const queryTokens = normalizedQuery.split(/\s+/).filter(t => t.length > 2);
            
            // Count how many query tokens are in the text
            let matchCount = 0;
            for (const token of queryTokens) {
                if (normalizedText.includes(token)) {
                    matchCount++;
                }
            }
            
            // Consider it a match if more than half of the tokens are found
            return queryTokens.length > 0 && matchCount / queryTokens.length > 0.5;
        };
        
        // Calculate a combined score using multiple factors
        const scoredResults = results.map(result => {
            // Start with the semantic similarity score
            let combinedScore = result.score;
            
            // Factor 1: Boost if there's an exact match
            if (exactMatch(result.text)) {
                combinedScore += 0.3;
            }
            
            // Factor 2: Balance between large and small chunks
            // Slightly prefer smaller chunks which are more focused
            const normalizedLength = Math.min(1, result.text.length / 2000);
            const lengthScore = 0.1 * (1 - normalizedLength);
            combinedScore += lengthScore;
            
            // Factor 3: Proximity of query terms
            // If multiple terms appear close together, boost the score
            const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
            if (words.length > 1) {
                const text = result.text.toLowerCase();
                let proximitySumWeight = 0;
                
                for (let i = 0; i < words.length - 1; i++) {
                    for (let j = i + 1; j < words.length; j++) {
                        const word1 = words[i];
                        const word2 = words[j];
                        
                        const pos1 = text.indexOf(word1);
                        const pos2 = text.indexOf(word2);
                        
                        if (pos1 >= 0 && pos2 >= 0) {
                            // Calculate proximity (closer is better)
                            const distance = Math.abs(pos1 - pos2);
                            const maxDistance = text.length / 2;
                            const proximityWeight = 0.1 * (1 - Math.min(1, distance / maxDistance));
                            proximitySumWeight += proximityWeight;
                        }
                    }
                }
                
                // Add proximity score (normalized by number of word pairs)
                const wordPairs = (words.length * (words.length - 1)) / 2;
                if (wordPairs > 0) {
                    combinedScore += proximitySumWeight / wordPairs;
                }
            }
            
            return { ...result, score: combinedScore };
        });
        
        // Sort by combined score
        scoredResults.sort((a, b) => b.score - a.score);
        
        // Return top results
        return scoredResults.slice(0, limit);
    }
    
    cosineSimilarity(vec1: number[], vec2: number[]): number {
        if (vec1.length !== vec2.length) {
            console.error(`Vector dimensions don't match: ${vec1.length} vs ${vec2.length}`);
            return 0;
        }
        
        // Calculate dot product
        let dotProduct = 0;
        let mag1 = 0;
        let mag2 = 0;
        
        for (let i = 0; i < vec1.length; i++) {
            dotProduct += vec1[i] * vec2[i];
            mag1 += vec1[i] * vec1[i];
            mag2 += vec2[i] * vec2[i];
        }
        
        // Calculate magnitudes
        mag1 = Math.sqrt(mag1);
        mag2 = Math.sqrt(mag2);
        
        // Avoid division by zero
        if (mag1 === 0 || mag2 === 0) {
            return 0;
        }
        
        // Return cosine similarity
        return dotProduct / (mag1 * mag2);
    }
    
    clear() {
        this.db.clear();
    }
    
    size() {
        return this.db.size;
    }
    
    /**
     * Checks if query appears in text (case insensitive)
     */
    private exactMatch(query: string, text: string): boolean {
        const normalizedQuery = query.toLowerCase();
        const normalizedText = text.toLowerCase();
        
        // Simple full string match
        if (normalizedText.includes(normalizedQuery)) {
            return true;
        }
        
        // Multi-word match (more than 50% of words match)
        const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 2);
        if (queryWords.length > 1) {
            let matchCount = 0;
            
            for (const word of queryWords) {
                if (normalizedText.includes(word)) {
                    matchCount++;
                }
            }
            
            // If more than half the words match, count it as an exact match
            if (matchCount / queryWords.length > 0.5) {
                return true;
            }
        }
        
        return false;
    }
}