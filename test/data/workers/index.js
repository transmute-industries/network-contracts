const faker = require('faker');

module.exports = accounts => {
  return accounts.map(account => {
    return {
      address: account,
      // email: faker.internet.email(),
      balance: 100,
      rep: Math.random()
    };
  });
};
