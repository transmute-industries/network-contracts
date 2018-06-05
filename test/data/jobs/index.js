const faker = require('faker');

module.exports = (workers, functions) => {
  const jobs = workers.map((worker, index) => {
    const op = Math.floor(Math.random() * 2) ? 'get' : 'set';
    const input =
      op === 'set'
        ? {
            key: worker.address,
            value: faker.random.image()
          }
        : {
            key: worker.address
          };

    return {
      id: index,
      status: 'ready',
      employer: {
        ...worker
        // title: faker.name.jobTitle()
      },
      employee: null,
      input: input,
      function: {
        [op]: functions[op]
      },
      output: null,
      price: 1
    };
  });

  return jobs;
};
