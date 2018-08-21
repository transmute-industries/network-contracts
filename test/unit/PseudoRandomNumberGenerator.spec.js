const PseudoRandomNumberGenerator = artifacts.require('./PseudoRandomNumberGenerator.sol');
const {blockMiner} = require('../utils.js');

contract('PseudoRandomNumberGenerator', (accounts) => {
  let prng;

  describe('getPseudoRandomNumber', () => {
    let initialValue;
    const person1 = accounts[1];
    const person2 = accounts[2];

    before(async () => {
      prng = await PseudoRandomNumberGenerator.deployed();
      initialValue = await prng.getPseudoRandomNumber.call({from: person1});
    });

    it('should return the same value for two calls with the same sender and block number', async () => {
      const consecutiveValue = await prng.getPseudoRandomNumber.call({from: person1});
      assert.deepEqual(initialValue, consecutiveValue);
    });

    it('should return a different value with a different sender', async () => {
      const consecutiveValue = await prng.getPseudoRandomNumber.call({from: person2});
      assert.notDeepEqual(initialValue, consecutiveValue);
    });


    it('should return a different value after one block is mined', async () => {
      await blockMiner.mine(1);
      const valueAfterOneBlock = await prng.getPseudoRandomNumber.call({from: person1});
      assert.notDeepEqual(initialValue, valueAfterOneBlock);
    });

    // Note: Those tests are statistical, in some rare cases they may fail
    describe('Statistical distribution of last digit', () => {
      let occurencesOf = {};
      let numberOfTries = 100;
      let mean;

      before(async () => {
        prng = await PseudoRandomNumberGenerator.deployed();
        for (let i = 0; i < numberOfTries; i++) {
          const randomNumber = await prng.getPseudoRandomNumber.call();
          const lastDigit = randomNumber.mod(10).toNumber();
          if (occurencesOf[lastDigit]) {
            occurencesOf[lastDigit] += 1;
          } else {
            occurencesOf[lastDigit] = 1;
          }
          // Mine a block because so that block.number changes
          await blockMiner.mine(1);
        }
      });

      it('should have the correct mean', async () => {
        mean = Object.keys(occurencesOf)
          .map((lastDigit) => lastDigit * occurencesOf[lastDigit])
          .reduce((a, b) => a + b) / numberOfTries;
        // Theoretical mean is 4.5
        const interval = 1;
        assert(4.5 - interval < mean && mean < 4.5 + interval);
      });

      it('should have the correct variance', async () => {
        const variance = Object.keys(occurencesOf)
          .map((lastDigit) => occurencesOf[lastDigit] * (lastDigit - mean) ** 2)
          .reduce((a, b) => a + b) / numberOfTries;
        // Theoretical variance is 8.25
        const interval = 2;
        assert(8.25 - interval < variance && variance < 8.25 + interval);
      });

      it('should be a uniform distribution', async () => {
        // Assert that every digit 0-9 appeared at least twice out of numberOfTries times (99% of chance)
        for (lastDigit of Object.keys(occurencesOf)) {
          assert(2 < occurencesOf[lastDigit]);
        }
      });
    });
  });
});

