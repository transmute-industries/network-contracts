const JobManager = artifacts.require('./JobManager.sol');
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

    it('should increase the value of numberOfMinerals', async () => {
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
});
