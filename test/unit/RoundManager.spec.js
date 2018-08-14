const RoundManager = artifacts.require('./RoundManager.sol');
const TransmuteDPOS = artifacts.require('./TestTransmuteDPOS.sol');
const {roundManagerHelper, blockMiner, assertFail} = require('../utils.js');
require('truffle-test-utils').init();

contract('RoundManager', (accounts) => {
  let rm;
  let tdpos;
  let contractAddress;

  let owner = accounts[0];
  let provider1 = accounts[1];
  let provider2 = accounts[2];
  let provider3 = accounts[3];
  let provider4 = accounts[4];
  const ELECTION_PERIOD_LENGTH = 20;
  const RATE_LOCK_DEADLINE = 5;
  const UNBONDING_PERIOD = 10;
  const PROVIDER_POOL_SIZE = 20;
  const NUMBER_OF_ACTIVE_PROVIDERS = 10;

  describe('setElectionPeriodLength', () => {
    let result;

    before(async () => {
      rm = await RoundManager.deployed();
      result = await rm.setElectionPeriodLength(ELECTION_PERIOD_LENGTH, {from: owner});
    });

    it('should set the electionPeriodLength value', async () => {
      assert.equal(ELECTION_PERIOD_LENGTH, await rm.electionPeriodLength.call());
    });

    it('should emit a ParameterChanged event', async () => {
      assert.web3Event(result, {
        event: 'ParameterChanged',
        args: {
          name: 'electionPeriodLength',
          oldValue: 0,
          newValue: ELECTION_PERIOD_LENGTH,
        },
      });
    });
  });

  describe('setRateLockDeadline', () => {
    let result;

    before(async () => {
      result = await rm.setRateLockDeadline(RATE_LOCK_DEADLINE, {from: owner});
    });

    it('should set the rateLockDeadline value', async () => {
      assert.equal(RATE_LOCK_DEADLINE, await rm.rateLockDeadline.call());
    });

    it('should emit a ParameterChanged event', async () => {
      assert.web3Event(result, {
        event: 'ParameterChanged',
        args: {
          name: 'rateLockDeadline',
          oldValue: 0,
          newValue: RATE_LOCK_DEADLINE,
        },
      });
    });
  });

  describe('setUnbondingPeriod', () => {
    let result;

    before(async () => {
      result = await rm.setUnbondingPeriod(UNBONDING_PERIOD, {from: owner});
    });

    it('should set the unbondingPeriod value', async () => {
      assert.equal(UNBONDING_PERIOD, await rm.unbondingPeriod.call());
    });

    it('should emit a ParameterChanged event', async () => {
      assert.web3Event(result, {
        event: 'ParameterChanged',
        args: {
          name: 'unbondingPeriod',
          oldValue: 0,
          newValue: UNBONDING_PERIOD,
        },
      });
    });
  });

  describe('initializeRound', () => {
    before(async () => {
      await rm.setProviderPoolMaxSize(PROVIDER_POOL_SIZE);
      // Make sure that block.number > electionPeriodLength otherwise some tests containing initializeRound might fail
      // it is ok to do this because in the main network block.number >> 100
      await blockMiner.mine(100);
    });

    it('should fail if numberOfActiveProviders is not set', async () => {
      await assertFail( rm.initializeRound() );
      assert.equal(0, await rm.roundNumber.call());
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

  describe('setActiveProviders', () => {
    let provider1Stake = 100;
    let provider2Stake = 400;
    let provider3Stake = 200;

    async function approveBondProvider(pricePerStorageMineral, pricePerComputeMineral, blockRewardCut, feeShare, amountBonded, provider) {
      await tdpos.approve(contractAddress, amountBonded, {from: provider});
      await tdpos.bond(provider, amountBonded, {from: provider});
      await tdpos.provider(pricePerStorageMineral, pricePerComputeMineral, blockRewardCut, feeShare, {from: provider});
    }

    before(async () => {
      // Here we use the TransmuteDPOS contract instead of RoundManager contract
      // even though we want to test a method from the RoundManager contract
      // because we need to fill the providerPool using methods from TransmuteDPOS
      tdpos = await TransmuteDPOS.deployed();
      contractAddress = tdpos.address;
      for (let i = 0; i < 10; i++) {
        await tdpos.mint(accounts[i], 1000, {from: accounts[0]});
      }
      await tdpos.setNumberOfActiveProviders(2);
      await tdpos.initializeRound();
      // After the 3 providers are registered the providerPool should be
      // Rank 1: provider2 with 400 TST;
      // Rank 2: provider3 with 200 TST;
      // Rank 3: provider1 with 100 TST;
      // Since numberOfActiveProviders is 2 only provider2 and provider3
      // should be active. provider1 is registered but not active
      await approveBondProvider(11, 21, 31, 41, provider1Stake, provider1);
      await approveBondProvider(12, 22, 32, 42, provider2Stake, provider2);
      await approveBondProvider(13, 23, 33, 43, provider3Stake, provider3);
      const newRoundBlock = await roundManagerHelper.getElectionPeriodEndBlock(tdpos);
      await blockMiner.mineUntilBlock(newRoundBlock);
      await tdpos.initializeRound();
    });


    it('should create a new ActiveProviderSet for the round with right totalStake', async () => {
      const roundNumber = await tdpos.roundNumber.call();
      // activeProviderSets.call(roundNumber) only returns the active totalStake
      // not the array of provider addresses nor the isActive mapping
      const totalStake = await tdpos.activeProviderSets.call(roundNumber);
      assert.equal(provider2Stake + provider3Stake, totalStake);
    });

    it('should contain the addresses of active providers', async () => {
      const activeProviderAddresses = await tdpos.getActiveProviderAddresses.call();
      assert.equal(2, activeProviderAddresses.length);
      assert.equal(provider2, activeProviderAddresses[0]);
      assert.equal(provider3, activeProviderAddresses[1]);
    });

    it('should not contain the addresses of not active providers', async () => {
      const activeProviderAddresses = await tdpos.getActiveProviderAddresses.call();
      // provider1 is registered but not active
      assert(!activeProviderAddresses.includes(provider1));
      // provider4 is not registered
      assert(!activeProviderAddresses.includes(provider4));
    });

    it('should set active provider parameters in activeProviders mapping', async () => {
      const activeProvider2 = await tdpos.activeProviders.call(provider2);
      let [pricePerStorageMineral, pricePerComputeMineral,
        blockRewardCut, feeShare] = activeProvider2;
      assert.equal(12, pricePerStorageMineral);
      assert.equal(22, pricePerComputeMineral);
      assert.equal(32, blockRewardCut);
      assert.equal(42, feeShare);
      const activeProvider3 = await tdpos.activeProviders.call(provider3);
      [pricePerStorageMineral, pricePerComputeMineral,
        blockRewardCut, feeShare] = activeProvider3;
      assert.equal(13, pricePerStorageMineral);
      assert.equal(23, pricePerComputeMineral);
      assert.equal(33, blockRewardCut);
      assert.equal(43, feeShare);
    });

    it('should not set non active provider parameters in activeProviders mapping', async () => {
      // provider1 is registered but not active
      const activeProvider1 = await tdpos.activeProviders.call(provider1);
      let [pricePerStorageMineral, pricePerComputeMineral,
        blockRewardCut, feeShare] = activeProvider1;
      assert.equal(0, pricePerStorageMineral);
      assert.equal(0, pricePerComputeMineral);
      assert.equal(0, blockRewardCut);
      assert.equal(0, feeShare);
      // provider4 is not registered
      const activeProvider4 = await tdpos.activeProviders.call(provider4);
      [pricePerStorageMineral, pricePerComputeMineral,
        blockRewardCut, feeShare] = activeProvider4;
      assert.equal(0, pricePerStorageMineral);
      assert.equal(0, pricePerComputeMineral);
      assert.equal(0, blockRewardCut);
      assert.equal(0, feeShare);
    });
  });

  describe('removeActiveProvider', () => {
    let provider1 = accounts[1];
    let provider2 = accounts[2];

    before(async () => {
      // As a reminder, provider1 is Registered but not active
      // and provider2 and provider3 are RegisteredAndActive
      tdpos = await TransmuteDPOS.deployed();
    });

    it('should fail if not called by an active Provider', async () => {
      await assertFail( tdpos.publicRemoveActiveProvider(provider1) );
    });

    describe('Provider is removed as active Provider', () => {
      let roundNumber;
      let providerStake;
      let totalStake;
      let provider2Parameters;

      before(async () => {
        // Assert that everything is set as it should be for provider2
        const activeProviderAddresses = await tdpos.getActiveProviderAddresses.call();
        assert.equal(true, activeProviderAddresses.includes(provider2));
        assert.equal(true, await tdpos.isProviderActive.call(provider2));
        roundNumber = await tdpos.roundNumber.call();
        providerStake = await tdpos.getProviderStake(provider2);
        totalStake = await tdpos.activeProviderSets.call(roundNumber);
        provider2Parameters = await tdpos.activeProviders.call(provider2);
        let [pricePerStorageMineral, pricePerComputeMineral,
          blockRewardCut, feeShare] = provider2Parameters;
        assert.equal(12, pricePerStorageMineral);
        assert.equal(22, pricePerComputeMineral);
        assert.equal(32, blockRewardCut);
        assert.equal(42, feeShare);

        await tdpos.publicRemoveActiveProvider(provider2);
      });

      it('should remove Provider from the Active Provider addresses', async () => {
        const activeProviderAddresses = await tdpos.getActiveProviderAddresses.call();
        assert.equal(false, activeProviderAddresses.includes(provider2));
      });

      it('should set Provider as inactive', async () => {
        assert.equal(false, await tdpos.isProviderActive.call(provider2));
      });

      it('should decrease the totalStake of the current active set by the stake of the Provider', async () => {
        const newTotalStake = await tdpos.activeProviderSets.call(roundNumber);
        assert.deepEqual(totalStake.sub(providerStake), newTotalStake);
      });

      it('should remove parameters from the activeProviders mapping', async () => {
        provider2Parameters = await tdpos.activeProviders.call(provider2);
        let [pricePerStorageMineral, pricePerComputeMineral,
          blockRewardCut, feeShare] = provider2Parameters;
        assert.equal(0, pricePerStorageMineral);
        assert.equal(0, pricePerComputeMineral);
        assert.equal(0, blockRewardCut);
        assert.equal(0, feeShare);
      });
    });
  });

  describe('declareUnavailability', () => {
    it('should fail if provider is not Active', async () => {
      assert.equal(false, await tdpos.isProviderActive.call(provider2));
      await assertFail( tdpos.declareUnavailability({from: provider2}) );
    });

    it('should set the Provider as Unavailable', async () => {
      assert.equal(true, await tdpos.isProviderActive.call(provider3));
      assert.equal(false, await tdpos.isProviderUnavailable.call(provider3));
      await tdpos.declareUnavailability({from: provider3});
      assert.equal(true, await tdpos.isProviderUnavailable.call(provider3));
    });
  });

  describe('declareAvailability', () => {
    it('should fail if provider is not Active', async () => {
      assert.equal(false, await tdpos.isProviderActive.call(provider2));
      await assertFail( tdpos.declareAvailability({from: provider2}) );
    });

    it('should set the Provider as Available', async () => {
      assert.equal(true, await tdpos.isProviderActive.call(provider3));
      assert.equal(true, await tdpos.isProviderUnavailable.call(provider3));
      await tdpos.declareAvailability({from: provider3});
      assert.equal(false, await tdpos.isProviderUnavailable.call(provider3));
    });
  });
});
