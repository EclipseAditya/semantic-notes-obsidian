export interface SemanticNotesSettings {
    openRouterApiKey: string;
    embeddingModel: string;
    llmModel: string;
    maxContextLength: number;
    useReranking: boolean;
    persistentStorage: boolean;
}

export interface SearchResult {
    path: string;
    score: number;
    content: string;
    basename: string;
    exactMatch: boolean;
}

export interface DocumentChunk {
    id: string;
    path: string;
    content: string;
    embedding?: number[];
    metadata?: {
        basename?: string;
        [key: string]: any;
    };
}

export interface EmbeddingData {
    model: string;
    vectors: Record<string, {
        embedding: number[];
        updatedAt: number;
    }>;
}

export interface OpenRouterCompletionRequest {
    model: string;
    messages: {
        role: string;
        content: string;
    }[];
}

export interface OpenRouterCompletionResponse {
    choices: {
        message: {
            content: string;
        };
    }[];
}