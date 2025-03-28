import { SettingsManager } from './settings';
import { EmbeddingManager } from './embedding-manager';
import { VectorDatabaseManager } from './vector-database';
import { SearchResult, AIQuestionResults } from './types';
import { Notice } from 'obsidian';

export class RAGService {
    settings: SettingsManager;
    openRouter: any = null;
    
    constructor(settings: SettingsManager) {
        this.settings = settings;
        this.initializeOpenRouter();
    }
    
    initializeOpenRouter() {
        // In a real implementation, we would initialize an actual OpenRouter client here
        // For this example, we're just creating a mock to demonstrate the functionality
        if (this.settings.openRouterApiKey) {
            this.openRouter = {
                initialized: true,
                apiKey: this.settings.openRouterApiKey
            };
        }
    }
    
    ensureOpenRouter() {
        if (!this.openRouter && this.settings.openRouterApiKey) {
            this.initializeOpenRouter();
        }
    }
    
    async answerQuestion(question: string, vectorDbManager: VectorDatabaseManager, embeddingManager: EmbeddingManager): Promise<AIQuestionResults> {
        try {
            this.ensureOpenRouter();
            
            if (!this.openRouter) {
                throw new Error("OpenRouter API key not configured");
            }
            
            // 1. Get relevant notes for context
            const limit = this.settings.contextLength;
            const notes = await vectorDbManager.searchSimilar(question, embeddingManager, limit, this.settings.useReranking);
            
            if (notes.length === 0) {
                return {
                    answer: "I couldn't find any relevant information in your notes to answer this question.",
                    sources: [],
                    shouldShowSources: false
                };
            }
            
            // 2. Format context from notes
            const context = this.formatContextFromNotes(notes);
            
            // 3. Create prompt with question and context
            const prompt = this.createPrompt(question, context);
            
            // 4. Call OpenRouter API
            const answer = await this.callOpenRouter(prompt);
            
            return {
                answer,
                sources: notes,
                shouldShowSources: true
            };
        } catch (error: any) {
            console.error("Error answering question:", error);
            return {
                answer: `Error: ${error.message}`,
                sources: [],
                shouldShowSources: false
            };
        }
    }
    
    formatContextFromNotes(notes: SearchResult[]): string {
        return notes.map((note, index) => {
            return `[${index + 1}] From "${note.title}":\n${note.text}\n`;
        }).join("\n");
    }
    
    createPrompt(question: string, context: string): string {
        return `You are a helpful assistant answering questions based on the user's notes.
Answer the following question based ONLY on the provided context from the user's notes.
If the context doesn't contain the information needed to answer, say "I don't have enough information in your notes to answer this question."

CONTEXT:
${context}

QUESTION: ${question}

ANSWER:`;
    }
    
    async callOpenRouter(prompt: string): Promise<string> {
        try {
            if (!this.settings.openRouterApiKey) {
                throw new Error("OpenRouter API key not configured");
            }
            
            if (!this.settings.llmModel) {
                throw new Error("LLM model not selected");
            }
            
            // In a real implementation, we would call the OpenRouter API here
            // For now, we'll just simulate a response with a delay
            
            new Notice("Generating response...");
            
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // For testing purposes, generate a response based on the prompt
            // In a real implementation, this would be the response from the API
            const modelInfo = this.settings.llmModel ? this.settings.llmModel.split('/') : ['unknown'];
            const modelName = modelInfo.length > 1 ? modelInfo.pop() || 'unknown' : modelInfo[0];
            const llmModel = modelName.split(':')[0];
            
            let fakeResponse = `Based on the available notes, `;
            
            // Extract the question from the prompt
            const questionMatch = prompt.match(/QUESTION: (.*?)\n/);
            if (questionMatch && questionMatch[1]) {
                const question = questionMatch[1].toLowerCase();
                
                if (question.includes("what") && question.includes("obsidian")) {
                    fakeResponse += `Obsidian is a powerful knowledge base that works on top of a local folder of plain text Markdown files. It allows you to create a network of linked thoughts with bidirectional linking, tagging, and a graph view to visualize connections between your notes.`;
                } else if (question.includes("how") && question.includes("semantic search")) {
                    fakeResponse += `semantic search in your notes works by converting both your query and note contents into embeddings (numerical representations) and finding notes with similar meaning, not just matching keywords. This allows you to find conceptually related information even when exact terms don't match.`;
                } else if (question.includes("embedding") || question.includes("vector")) {
                    fakeResponse += `embeddings are numerical representations of text that capture semantic meaning. In this plugin, notes are converted to these vector representations and stored in a vector database. When you search, your query is also converted to an embedding and the system finds notes with similar vector representations.`;
                } else {
                    fakeResponse += `I don't have enough information in your notes to answer this question with confidence. Consider adding more detailed notes about this topic.`;
                }
            } else {
                fakeResponse += `I don't have enough information in your notes to answer this question.`;
            }
            
            fakeResponse += `\n\n(Response generated using simulated ${llmModel})`;
            
            return fakeResponse;
        } catch (error: any) {
            console.error("Error calling OpenRouter:", error);
            throw error;
        }
    }
}