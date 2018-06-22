const TimeManager = artifacts.require('./TimeManager.sol');
const { blockMiner, assertFail } = require('./utils.js');

contract('TimeManager', accounts => {

  let tm, roundLength;

  describe('initializeRound', () => {

    before(async () => {
      tm = await TimeManager.deployed();
      roundLength = await tm.roundLength.call();
      await blockMiner.init(web3);
    });

    beforeEach(async () => {
      // Adds block so that the next block is the beginning of a next round 
      // ie adds blocks so that (blockNumber + 1) % roundLength === 0
      await blockMiner.mineUntilBeginningOfNextRound(roundLength);
      assert.equal(0, (web3.eth.blockNumber + 1) % roundLength);
      await tm.initializeRound();
    });

    it('should initialize the round', async () => {
      const blockNumber = web3.eth.blockNumber;
      const roundNumber = Math.floor(blockNumber / roundLength);
      assert.equal(roundNumber, await tm.lastRound.call());
    });

    it('should fail to initialize a new round one block after initializing the last round', async () => {
      await assertFail(tm.initializeRound());
    });

    it('should fail to initialize a new round roundLength - 1 block after initializing the last round', async () => {
      // Adds roundLength - 2 blocks
      await blockMiner.mine(roundLength - 2);
      // Adds one block. It should fail because we are still in the current round (roundLength - 2 + 1 = roundLength - 1)
      await assertFail(tm.initializeRound());
    });

    it('should initialize the next round roundLength blocks after initializing the last round', async () => {
      await blockMiner.mine(roundLength - 1);
      await tm.initializeRound();
    });
  });
});
