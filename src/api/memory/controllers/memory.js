'use strict';

const { Pinecone } = require('@pinecone-database/pinecone');
const axios = require('axios');

let pineconeClient;

async function initPinecone() {
  const pinecone = new Pinecone();
  await pinecone.init({
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENV,
  });
  pineconeClient = pinecone;
}

async function getPineconeClient() {
  if (!pineconeClient) {
    await initPinecone();
  }
  return pineconeClient;
}

// ✅ EMBEDDING FUNCTION – Make sure this is declared before usage
async function getEmbedding(text) {
  const res = await axios.post(
    'https://api.openai.com/v1/embeddings',
    {
      input: text,
      model: 'text-embedding-ada-002',
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    }
  );

  return res.data.data[0].embedding;
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
      const pinecone = await getPineconeClient();
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

      ctx.send({ status: 'stored', project, title });
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
      const pinecone = await getPineconeClient();
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
