const RoundManager = artifacts.require('./RoundManager.sol');
const { blockMiner, assertFail } = require('./utils.js');

contract('RoundManager', accounts => {

  let rm, electionPeriodLength;

  describe('initializeRound', () => {

    before(async () => {
      rm = await RoundManager.deployed();
      electionPeriodLength = await rm.electionPeriodLength.call();
      await blockMiner.mineUntilEndOfElectionPeriod(rm);
      assert.equal(0, (web3.eth.blockNumber + 1) % electionPeriodLength);
    });

    it('should initialize the round', async () => {
      await rm.initializeRound();
      assert.equal(1, await rm.roundNumber.call());
    });

    it('should initialize the next round electionPeriodLength blocks after initializing the last round', async () => {
      await blockMiner.mine(electionPeriodLength - 1);
      await rm.initializeRound();
    });

    it('should fail to initialize a new round one block after initializing the last round', async () => {
      await assertFail(rm.initializeRound());
    });

    it('should fail to initialize a new round electionPeriodLength - 1 block after initializing the last round', async () => {
      await blockMiner.mine(electionPeriodLength - 3);
      // Here the next initializeRound() call will happen on the (electionPeriodLength - 1)th block of the current round
      await assertFail(rm.initializeRound());
    });
  });
});
