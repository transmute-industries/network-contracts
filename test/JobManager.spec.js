const JobManager = artifacts.require('./JobManager.sol');
const { assertFail } = require('./utils.js');
require('truffle-test-utils').init();

contract('JobManager', accounts => {

  let jm;

  describe('submitMineral', () => {

    before(async () => {
      jm = await JobManager.deployed();
    });

    it('should store the Mineral in the minerals mapping', async () => {
      await jm.submitMineral('multiplication');
      const mineral = await jm.minerals.call(0);
      assert.equal('multiplication', mineral);
    });

    it('should increment numberOfMinerals', async () => {
      const numberOfMinerals = await jm.numberOfMinerals.call();
      await jm.submitMineral('addition');
      assert.deepEqual(numberOfMinerals.add(1), await jm.numberOfMinerals.call())
    });

    it('should emit a MineralAdded event', async () => {
      let result = await jm.submitMineral('division');
      assert.web3Event(result, {
        event: 'MineralAdded',
        args: {
          id: 2,
          name: 'division',
        }
      });
    });
  });

  describe('job', () => {

    let expirationBlock = web3.eth.blockNumber + 1000;

    before(async () => {
      jm = await JobManager.new();
      await jm.submitMineral("multiplication");
      await jm.submitMineral("addition");
    });

    it('should fail if mineralId is not the id of a valid Mineral', async () => {
      await assertFail( jm.job(2, 10, expirationBlock) );
      await jm.job(0, 10, expirationBlock);
    });

    it('should fail if expiration block is not in the future', async () => {
      const blockInThePast = web3.eth.blockNumber;
      await assertFail( jm.job(0, 10, blockInThePast) );
      const presentBlock = web3.eth.blockNumber + 1;
      await assertFail( jm.job(0, 10, presentBlock) );
      const blockInTheFuture = web3.eth.blockNumber + 2;
      await jm.job(0, 10, blockInTheFuture);
    });

    it('should store the Job parameters in the jobs mapping', async () => {
      const jobId = await jm.numberOfJobs.call();
      await jm.job(1, 11, expirationBlock + 42);
      const job = await jm.jobs.call(jobId);
      const [mineralId, minPricePerMineral, expBlock] = job;
      assert.equal(1, mineralId);
      assert.equal(11, minPricePerMineral);
      assert.equal(expirationBlock + 42, expBlock);
    });

    it('should emit a JobAdded event', async () => {
      const jobId = await jm.numberOfJobs.call();
      let result = await jm.job(1, 12, expirationBlock);
      assert.web3Event(result, {
        event: 'JobAdded',
        args: {
          id: jobId.toNumber(),
          mineralId: 1,
          minPricePerMineral: 12,
          expirationBlock: expirationBlock
        }
      });
    });

    it('should increment numberOfJobs', async () => {
      const numberOfJobs = await jm.numberOfJobs.call();
      await jm.job(1, 12, expirationBlock);
      assert.deepEqual(numberOfJobs.add(1), await jm.numberOfJobs.call())
    });
  });
});
