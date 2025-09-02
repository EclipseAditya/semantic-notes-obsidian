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

## Images
1.png: Configuration options settings
<img width="1151" height="887" alt="1" src="https://github.com/user-attachments/assets/a915353e-2cfa-46f8-8006-70c53a461e87" />

2.png: Command options through command palette
<img width="1517" height="897" alt="2" src="https://github.com/user-attachments/assets/9e96f59b-897f-4b61-a693-2ca9145af4f0" />

3_example note.png: eg note created from rough note
<img width="1276" height="887" alt="3_example note" src="https://github.com/user-attachments/assets/48aa6a05-d8a3-4fc3-bfd1-d08fb3c3ee33" />

3_example-refactor.png: refactored vault graph view
<img width="1425" height="922" alt="3_example-refactor" src="https://github.com/user-attachments/assets/918a512c-cf49-4969-8772-45ef52773a37" />

4.png: semantic view of similar notes
<img width="1782" height="977" alt="4" src="https://github.com/user-attachments/assets/75c23c02-c6ef-4567-9877-0e6e63e9b2b8" />

5.png: Smart semantic search
<img width="1356" height="992" alt="5" src="https://github.com/user-attachments/assets/5d15496c-caf0-47ca-88fb-2675eef56f3a" />

6.png: Example usage of Brain working(recreation of all vault notes with better quality and semantics)
<img width="1323" height="943" alt="6" src="https://github.com/user-attachments/assets/419d48a7-aba1-4730-bf24-9496015fe126" />

7.png: Topic extraction feature usage
<img width="1876" height="1003" alt="7" src="https://github.com/user-attachments/assets/f5138f17-140c-4602-a7db-a18147a09f3b" />

8.png: Ask ai about your notes interface(rag model)
<img width="1053" height="550" alt="8" src="https://github.com/user-attachments/assets/6d1c3504-3ad3-47b2-9193-58e25f440220" />

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
