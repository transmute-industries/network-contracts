const RoundManager = artifacts.require('./RoundManager.sol');
const { blockMiner, assertFail } = require('./utils.js');

contract('RoundManager', accounts => {

  let rm, roundLength;

  describe('initializeRound', () => {

    before(async () => {
      rm = await RoundManager.deployed();
      roundLength = await rm.roundLength.call();
    });

    beforeEach(async () => {
      // Adds block so that the next block is the beginning of a next round 
      // ie adds blocks so that (blockNumber + 1) % roundLength === 0
      await blockMiner.mineUntilBeginningOfNextRound(rm);
      assert.equal(0, (web3.eth.blockNumber + 1) % roundLength);
      await rm.initializeRound();
    });

    it('should initialize the round', async () => {
      const blockNumber = web3.eth.blockNumber;
      const roundNumber = Math.floor(blockNumber / roundLength);
      assert.equal(roundNumber, await rm.lastRound.call());
    });

    it('should fail to initialize a new round one block after initializing the last round', async () => {
      await assertFail(rm.initializeRound());
    });

    it('should fail to initialize a new round roundLength - 1 block after initializing the last round', async () => {
      // Adds roundLength - 2 blocks
      await blockMiner.mine(roundLength - 2);
      // Adds one block. It should fail because we are still in the current round (roundLength - 2 + 1 = roundLength - 1)
      await assertFail(rm.initializeRound());
    });

    it('should initialize the next round roundLength blocks after initializing the last round', async () => {
      await blockMiner.mine(roundLength - 1);
      await rm.initializeRound();
    });
  });
});
