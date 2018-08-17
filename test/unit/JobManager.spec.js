const JobManager = artifacts.require('./TestJobManager.sol');
const {assertFail, blockMiner} = require('../utils.js');
require('truffle-test-utils').init();

contract('JobManager', (accounts) => {
  let jm;
  const MINERAL_COMPUTE = 0;
  const MINERAL_STORAGE = 1;

  describe('submitMineral', () => {
    before(async () => {
      jm = await JobManager.deployed();
    });

    it('should fail if category is not MINERAL_COMPUTE or MINERAL_STORAGE', async () => {
      await jm.submitMineral('test', MINERAL_COMPUTE);
      await jm.submitMineral('test', MINERAL_STORAGE);
      await assertFail( jm.submitMineral('test', 2) );
    });

    it('should store the Mineral in the minerals mapping', async () => {
      const mineralId = (await jm.numberOfMinerals.call()).toNumber();
      await jm.submitMineral('multiplication', MINERAL_COMPUTE, {from: accounts[0]});
      const mineral = await jm.minerals.call(mineralId);
      let [name, producer, category] = mineral;
      assert.equal('multiplication', name);
      assert.equal(accounts[0], producer);
      assert.equal(MINERAL_COMPUTE, category);
    });

    it('should increment numberOfMinerals', async () => {
      const numberOfMinerals = await jm.numberOfMinerals.call();
      await jm.submitMineral('addition', MINERAL_COMPUTE);
      assert.deepEqual(numberOfMinerals.add(1), await jm.numberOfMinerals.call());
    });

    it('should emit a MineralAdded event', async () => {
      const mineralId = (await jm.numberOfMinerals.call()).toNumber();
      let result = await jm.submitMineral('division', MINERAL_COMPUTE, {from: accounts[0]});
      assert.web3Event(result, {
        event: 'MineralAdded',
        args: {
          id: mineralId,
          name: 'division',
          producer: accounts[0],
          category: MINERAL_COMPUTE,
        },
      });
    });

    it('should fail if name is an empty string', async () => {
      const mineralId = (await jm.numberOfMinerals.call()).toNumber();
      await assertFail( jm.submitMineral('', MINERAL_COMPUTE) );
      await jm.submitMineral('non empty string', MINERAL_COMPUTE);
      const mineral = await jm.minerals.call(mineralId);
      let name = mineral[0];
      assert.equal('non empty string', name);
    });
  });

  describe('submitJob', () => {
    let expirationBlock = web3.eth.blockNumber + 1000;

    before(async () => {
      jm = await JobManager.new();
      await jm.submitMineral('multiplication', MINERAL_COMPUTE);
      await jm.submitMineral('addition', MINERAL_COMPUTE);
    });

    it('should fail if mineralId is not the id of a valid Mineral', async () => {
      await assertFail( jm.submitJob(2, 10, expirationBlock) );
      await jm.submitJob(0, 10, expirationBlock);
    });

    it('should fail if expiration block is not in the future', async () => {
      const blockInThePast = web3.eth.blockNumber;
      await assertFail( jm.submitJob(0, 10, blockInThePast) );
      const presentBlock = web3.eth.blockNumber + 1;
      await assertFail( jm.submitJob(0, 10, presentBlock) );
      const blockInTheFuture = web3.eth.blockNumber + 2;
      await jm.submitJob(0, 10, blockInTheFuture);
    });

    it('should store the Job parameters in the jobs mapping', async () => {
      const jobId = await jm.numberOfJobs.call();
      await jm.submitJob(1, 11, expirationBlock + 42);
      const job = await jm.jobs.call(jobId);
      const [mineralId, minPricePerMineral, expBlock] = job;
      assert.equal(1, mineralId);
      assert.equal(11, minPricePerMineral);
      assert.equal(expirationBlock + 42, expBlock);
    });

    it('should emit a JobAdded event', async () => {
      const jobId = await jm.numberOfJobs.call();
      let result = await jm.submitJob(1, 12, expirationBlock);
      assert.web3Event(result, {
        event: 'JobAdded',
        args: {
          id: jobId.toNumber(),
          mineralId: 1,
          minPricePerMineral: 12,
          expirationBlock: expirationBlock,
        },
      });
    });

    it('should increment numberOfJobs', async () => {
      const numberOfJobs = await jm.numberOfJobs.call();
      await jm.submitJob(1, 12, expirationBlock);
      assert.deepEqual(numberOfJobs.add(1), await jm.numberOfJobs.call());
    });
  });

  describe('getPseudoRandomNumber', () => {
    let initialValue;
    const person1 = accounts[1];
    const person2 = accounts[2];

    before(async () => {
      jm = await JobManager.deployed();
      initialValue = await jm.publicGetPseudoRandomNumber.call({from: person1});
    });

    it('should return the same value for two calls with the same sender and block number', async () => {
      const consecutiveValue = await jm.publicGetPseudoRandomNumber.call({from: person1});
      assert.deepEqual(initialValue, consecutiveValue);
    });

    it('should return a different value with a different sender', async () => {
      const consecutiveValue = await jm.publicGetPseudoRandomNumber.call({from: person2});
      assert.notDeepEqual(initialValue, consecutiveValue);
    });


    it('should return a different value after one block is mined', async () => {
      await blockMiner.mine(1);
      const valueAfterOneBlock = await jm.publicGetPseudoRandomNumber.call({from: person1});
      assert.notDeepEqual(initialValue, valueAfterOneBlock);
    });

    // Note: Those tests are statistical, in some rare cases they may fail
    describe('Statistical distribution of last digit', () => {
      let occurencesOf = {};
      let numberOfTries = 100;
      let mean;

      before(async () => {
        jm = await JobManager.deployed();
        for (let i = 0; i < numberOfTries; i++) {
          const randomNumber = await jm.publicGetPseudoRandomNumber.call();
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

  describe('selectProvider', () => {
    before(async () => {
      jm = await JobManager.deployed();
    });
  });
});
