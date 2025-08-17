'use strict';

const { Pinecone } = require('@pinecone-database/pinecone'); // v0.2.2 client
const axios = require('axios');

let pineconeClient;

async function initPinecone() {
  if (!pineconeClient) {
    pineconeClient = new Pinecone();
  }

  return pineconeClient;
}

// 🧠 Embedding function using Together AI's LLaMA v2
async function getEmbedding(text) {
  const response = await axios.post(
    'https://api.together.xyz/v1/embeddings',
    {
      model: 'togethercomputer/llama-2-7b-chat',
      input: [text],
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data.data[0].embedding;
}

module.exports = {
  async store(ctx) {
    try {
      const { text, project, type, title } = ctx.request.body;

      if (!text || !project) {
        ctx.badRequest("Missing 'text' or 'project' in body");
        return;
      }

      const embedding = await getEmbedding(text);
      const pinecone = await initPinecone();
      const index = pinecone.index(process.env.PINECONE_INDEX);

      await index.upsert([
        {
          id: `mem-${Date.now()}`,
          values: embedding,
          metadata: {
            project,
            type: type || 'note',
            title: title || '',
            text,
          },
        },
      ]);

      ctx.send({ status: 'stored', project, title: title || '' });
    } catch (error) {
      console.error('Memory Store Error:', error);
      ctx.status = 500;
      ctx.body = {
        error: 'Internal server error',
        details: error.message,
      };
    }
  },

  async recall(ctx) {
    try {
      const { query, project } = ctx.request.body;

      if (!query) {
        ctx.badRequest("Missing 'query' in body");
        return;
      }

      const embedding = await getEmbedding(query);
      const pinecone = await initPinecone();
      const index = pinecone.index(process.env.PINECONE_INDEX);

      const result = await index.query({
        vector: embedding,
        topK: 5,
        includeMetadata: true,
        filter: project ? { project } : undefined,
      });

      const matches = result.matches?.map((m) => m.metadata) || [];
      ctx.send({ results: matches });
    } catch (error) {
      console.error('Memory Recall Error:', error);
      ctx.status = 500;
      ctx.body = {
        error: 'Internal server error',
        details: error.message,
      };
    }
  },
};
