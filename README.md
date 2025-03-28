# Semantic Notes for Obsidian

AI-powered note management for Obsidian: semantic search, AI Q&A with OpenRouter integration, and automatic note linking through embeddings.

Source code repository: https://github.com/EclipseAditya/semantic-notes-obsidian

## Features

- **Semantic Search**: Find notes based on meaning, not just keywords
- **AI Q&A**: Ask questions about your notes and get AI-generated answers
- **Automatic Embeddings**: Notes are automatically indexed with embeddings
- **Exact Match Detection**: Combines semantic search with exact text matching for better results
- **OpenRouter Integration**: Leverage powerful language models through OpenRouter

## Installation

1. Download the latest release from the GitHub repository
2. Extract the zip file into your Obsidian plugins folder: `{vault}/.obsidian/plugins/`
3. Enable the plugin in Obsidian's settings under "Community Plugins"

## Setup

1. In the plugin settings, configure your OpenRouter API key (required for AI Q&A)
2. Select your preferred embedding model (UAE-Large-V1 recommended for best quality)
3. Choose your preferred language model for Q&A
4. Adjust other settings to your liking

The plugin will automatically start indexing your notes in the background. You can monitor the progress in the Obsidian notices.

## Usage

### Semantic Search

1. Use the command palette to open "Semantic Search" (Cmd/Ctrl+P and search for "Semantic Notes: Open Semantic Search")
2. Enter a natural language query (e.g., "What are the key benefits of meditation?")
3. View the search results ranked by relevance
4. Click on a result to open the corresponding note

### AI Q&A

1. Use the command palette to open "Ask AI a Question" (Cmd/Ctrl+P and search for "Semantic Notes: Ask AI a Question")
2. Enter a question about your notes (e.g., "What have I written about project management?")
3. The AI will search your notes for relevant information and provide an answer
4. View the source notes that were used to generate the answer

## How it Works

The plugin uses a local embedding model to convert your notes into vector representations that capture their semantic meaning. When you search or ask a question, your query is also converted to a vector and compared with your notes using cosine similarity.

For AI Q&A, the plugin:
1. Finds the most relevant notes using semantic search
2. Formats them as context for the language model
3. Sends the context and your question to OpenRouter
4. Returns the AI-generated answer along with the source notes

## Privacy

Your notes never leave your computer. The embedding process happens locally using Transformers.js. For AI Q&A, only the relevant snippets from your notes (needed to answer your question) are sent to OpenRouter.

## Configuration

- **Embedding Model**: Choose between several models with different speed/quality tradeoffs
- **LLM Model**: Select which language model to use for Q&A
- **Context Length**: Number of notes to include as context for AI answers
- **Re-ranking**: Enable advanced re-ranking for better search results
- **Persistent Storage**: Save embeddings between sessions

## License

MIT