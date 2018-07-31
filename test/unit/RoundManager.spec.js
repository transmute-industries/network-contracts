const RoundManager = artifacts.require('./RoundManager.sol');
const {blockMiner, assertFail} = require('../utils.js');

contract('RoundManager', (accounts) => {
  let rm;
  // TODO: Caps
  const electionPeriodLength = 20;
  const rateLockDeadline = 5;
  const unbondingPeriod = 10;
  const providerPoolMaxSize = 20;
  const numberOfActiveProviders = 10;

  describe('initializeRound', () => {
    before(async () => {
      rm = await RoundManager.deployed();
      await rm.setElectionPeriodLength(electionPeriodLength);
      await rm.setRateLockDeadline(rateLockDeadline);
      await rm.setUnbondingPeriod(unbondingPeriod);
      // Set ProviderPool parameters
      // TODO: Change name
      await rm.setMaxNumberOfProviders(providerPoolMaxSize);
    });

    it('should fail if numberOfActiveProviders is not set', async () => {
      await assertFail( rm.initializeRound() );
      assert.equal(0, await rm.roundNumber.call());
    });

    it('should initialize the round', async () => {
      await rm.setNumberOfActiveProviders(numberOfActiveProviders);
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
