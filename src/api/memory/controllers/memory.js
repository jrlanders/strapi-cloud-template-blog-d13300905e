'use strict';

const { Pinecone } = require('@pinecone-database/pinecone');
const axios = require('axios');

let pineconeClient;

async function initPinecone() {
  const pinecone = new Pinecone();
  await pinecone.init({
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,
  });
  pineconeClient = pinecone;
}

async function getPineconeClient() {
  if (!pineconeClient) {
    await initPinecone();
  }
  return pineconeClient;
}

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
    const { text, project, type, title } = ctx.request.body;

    if (!text || !project) {
      ctx.badRequest("Missing 'text' or 'project' in body");
      return;
    }

    const embedding = await getEmbedding(text);
    const pinecone = await getPineconeClient();
    const index = pinecone.index(process.env.PINECONE_INDEX); // create here safely

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
  },

  async recall(ctx) {
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
  },
};
