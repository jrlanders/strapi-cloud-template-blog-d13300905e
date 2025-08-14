'use strict';

const { Pinecone } = require('@pinecone-database/pinecone');
const axios = require('axios');

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
  environment: process.env.PINECONE_ENV,
});
const index = pinecone.Index(process.env.PINECONE_INDEX);

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
    const embedding = await getEmbedding(text);

    await index.upsert([
      {
        id: `mem-${Date.now()}`,
        values: embedding,
        metadata: { project, type, title, text },
      },
    ]);

    return { status: 'stored', project, type, title };
  },

  async recall(ctx) {
    const { query, project } = ctx.request.body;
    const embedding = await getEmbedding(query);

    const result = await index.query({
      vector: embedding,
      topK: 5,
      includeMetadata: true,
      filter: project ? { project } : undefined,
    });

    return result.matches.map((match) => match.metadata);
  },
};
