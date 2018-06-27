const RoundManager = artifacts.require('./RoundManager.sol');
const { blockMiner, assertFail } = require('./utils.js');

contract('RoundManager', accounts => {

  let rm, electionPeriodLength;

  describe('initializeRound', () => {

    before(async () => {
      rm = await RoundManager.deployed();
      electionPeriodLength = await rm.electionPeriodLength.call();
    });

    beforeEach(async () => {
      // Adds block so that the next block is the beginning of a next round 
      // ie adds blocks so that (blockNumber + 1) % electionPeriodLength === 0
      await blockMiner.mineUntilBeginningOfNextRound(rm);
      assert.equal(0, (web3.eth.blockNumber + 1) % electionPeriodLength);
      await rm.initializeRound();
    });

    it('should initialize the round', async () => {
      assert.equal(1, await rm.roundNumber.call());
    });

    it('should fail to initialize a new round one block after initializing the last round', async () => {
      await assertFail(rm.initializeRound());
    });

    it('should fail to initialize a new round electionPeriodLength - 1 block after initializing the last round', async () => {
      // Adds electionPeriodLength - 2 blocks
      await blockMiner.mine(electionPeriodLength - 2);
      // Adds one block.
      // It should fail because we are still in the current election period (electionPeriodLength - 2 + 1 = electionPeriodLength - 1)
      await assertFail(rm.initializeRound());
    });

    it('should initialize the next round electionPeriodLength blocks after initializing the last round', async () => {
      await blockMiner.mine(electionPeriodLength - 1);
      await rm.initializeRound();
    });
  });
});
