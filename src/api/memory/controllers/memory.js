'use strict';

module.exports = {
  async store(ctx) {
    ctx.send({ message: 'Memory store endpoint active' });
  },

  async recall(ctx) {
    ctx.send({ message: 'Memory recall endpoint active' });
  },
};
