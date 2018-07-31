const RoundManager = artifacts.require('./RoundManager.sol');
const {blockMiner, assertFail} = require('../utils.js');

contract('RoundManager', (accounts) => {
  let rm;
  const ELECTION_PERIOD_LENGTH = 20;
  const RATE_LOCK_DEADLINE = 5;
  const UNBONDING_PERIOD = 10;
  const PROVIDER_POOL_SIZE = 20;
  const NUMBER_OF_ACTIVE_PROVIDERS = 10;

  describe('initializeRound', () => {
    before(async () => {
      rm = await RoundManager.deployed();
      await rm.setElectionPeriodLength(ELECTION_PERIOD_LENGTH);
      await rm.setRateLockDeadline(RATE_LOCK_DEADLINE);
      await rm.setUnbondingPeriod(UNBONDING_PERIOD);
      // Set ProviderPool parameters
      await rm.setProviderPoolMaxSize(PROVIDER_POOL_SIZE);
    });

    it('should fail if numberOfActiveProviders is not set', async () => {
      await assertFail( rm.initializeRound() );
      assert.equal(0, await rm.roundNumber.call());
    });

    it('should initialize the round', async () => {
      await rm.setNumberOfActiveProviders(NUMBER_OF_ACTIVE_PROVIDERS);
      await rm.initializeRound();
      assert.equal(1, await rm.roundNumber.call());
    });

    it('should initialize the next round electionPeriodLength blocks after initializing the last round', async () => {
      await blockMiner.mine(ELECTION_PERIOD_LENGTH - 1);
      await rm.initializeRound();
    });

    it('should fail to initialize a new round one block after initializing the last round', async () => {
      await assertFail(rm.initializeRound());
    });

    it('should fail to initialize a new round electionPeriodLength - 1 block after initializing the last round', async () => {
      await blockMiner.mine(ELECTION_PERIOD_LENGTH - 3);
      // Here the next initializeRound() call will happen on the (electionPeriodLength - 1)th block of the current round
      await assertFail(rm.initializeRound());
    });
  });
});
