module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/memory/store',
      handler: 'memory.store',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/memory/recall',
      handler: 'memory.recall',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
